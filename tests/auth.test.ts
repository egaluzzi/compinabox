// @vitest-environment node
import { eq } from "drizzle-orm";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeWelcomeToken, createWelcomeToken } from "@/lib/auth/links";
import { buildSessionCookie } from "@/lib/auth/session";
import { schema } from "@/lib/db/client";
import { seedCompany, uid, useTestDb } from "./helpers/db";

const { verificationTokens } = schema;
let db: ReturnType<typeof useTestDb>;
let outbox: string;
beforeAll(() => {
  db = useTestDb();
});
beforeEach(() => {
  outbox = mkdtempSync(path.join(tmpdir(), "auth-outbox-"));
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-test-auth-secret-1234");
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  vi.stubEnv("EMAIL_DEV_SINK", "true");
  vi.stubEnv("EMAIL_SINK_DIR", outbox);
});

describe("welcome link (24 h, single-use) against the real DB", () => {
  it("works once; the second use fails", async () => {
    const { user } = await seedCompany(db);
    const token = await createWelcomeToken(db, user.email);
    expect(await consumeWelcomeToken(db, token)).toMatchObject({
      id: user.id,
      companyId: user.companyId,
    });
    expect(await consumeWelcomeToken(db, token)).toBeNull();
  });
  it("is stored hashed, not in clear", async () => {
    const { user } = await seedCompany(db);
    const token = await createWelcomeToken(db, user.email);
    const rows = await db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.identifier, `welcome:${user.email}`));
    expect(rows).toHaveLength(1);
    expect(rows[0].token).not.toBe(token);
  });
  it("is valid just inside 24 h and dead just after", async () => {
    const { user } = await seedCompany(db);
    const t0 = new Date(Date.now() - 24 * 3600 * 1000 + 60_000); // expires in 1 minute
    expect(
      await consumeWelcomeToken(
        db,
        await createWelcomeToken(db, user.email, t0),
      ),
    ).not.toBeNull();
    const t1 = new Date(Date.now() - 24 * 3600 * 1000 - 60_000); // expired 1 minute ago
    expect(
      await consumeWelcomeToken(
        db,
        await createWelcomeToken(db, user.email, t1),
      ),
    ).toBeNull();
  });
  it("garbage and empty tokens fail", async () => {
    expect(await consumeWelcomeToken(db, "nope")).toBeNull();
    expect(await consumeWelcomeToken(db, "")).toBeNull();
  });
  it("concurrent use: exactly one wins", async () => {
    const { user } = await seedCompany(db);
    const token = await createWelcomeToken(db, user.email);
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => consumeWelcomeToken(db, token)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("session cookie issued by our own flows is a valid Auth.js JWT", () => {
  it("round-trips through Auth.js's decoder with company and user ids", async () => {
    const { decode } = await import("next-auth/jwt");
    const c = await buildSessionCookie({
      id: "u1",
      email: "a@b.test",
      companyId: "c1",
    });
    expect(c.name).toBe("authjs.session-token");
    expect(c.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
    const tok = await decode({
      token: c.value,
      secret: process.env.AUTH_SECRET!,
      salt: c.name,
    });
    expect(tok).toMatchObject({
      userId: "u1",
      companyId: "c1",
      email: "a@b.test",
    });
  });
  it("uses the __Secure- name and Secure flag on https", async () => {
    vi.stubEnv("AUTH_URL", "https://app.example.test");
    const c = await buildSessionCookie({
      id: "u1",
      email: "a@b.test",
      companyId: "c1",
    });
    expect(c.name).toBe("__Secure-authjs.session-token");
    expect(c.options.secure).toBe(true);
  });
});

// The real Auth.js handlers, real DB, file-sink email: sign-in link request -> email -> click.
describe("Auth.js sign-in link (15 min, single-use, no enumeration)", () => {
  async function handlers() {
    return (await import("@/auth")).handlers;
  }
  const base = "http://localhost:3000";

  async function requestLink(email: string) {
    const h = await handlers();
    const csrfRes = await h.GET(new NextRequest(`${base}/api/auth/csrf`));
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    const csrfCookie = (csrfRes.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .join("; ");
    const body = new URLSearchParams({
      email,
      csrfToken,
      callbackUrl: `${base}/dashboard`,
    });
    return h.POST(
      new NextRequest(`${base}/api/auth/signin/email`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: csrfCookie,
        },
        body,
      }),
    );
  }
  const mails = () =>
    readdirSync(outbox).map(
      (f) =>
        JSON.parse(readFileSync(path.join(outbox, f), "utf8")) as {
          to: string;
          text: string;
        },
    );
  const linkIn = (text: string) => text.match(/https?:\/\/\S+/)![0];
  const click = async (url: string) =>
    (await handlers()).GET(new NextRequest(url));

  it("known email: a link is emailed; clicking it signs in once; reuse fails", async () => {
    const { user } = await seedCompany(db);
    const res = await requestLink(user.email);
    expect(res.status).toBe(302);
    const sent = mails().filter((m) => m.to === user.email);
    expect(sent).toHaveLength(1);
    const url = linkIn(sent[0].text);

    const ok = await click(url);
    expect(ok.status).toBe(302);
    expect(ok.headers.get("location")).toContain("/dashboard");
    expect((ok.headers.getSetCookie?.() ?? []).join("\n")).toContain(
      "authjs.session-token=",
    );

    const reuse = await click(url);
    expect(reuse.headers.get("location")).toMatch(/error/i);
    expect((reuse.headers.getSetCookie?.() ?? []).join("\n")).not.toContain(
      "authjs.session-token=",
    );
  });

  it("an expired link fails (15 min TTL, set in the DB to the past)", async () => {
    const { user } = await seedCompany(db);
    await requestLink(user.email);
    const url = linkIn(mails().find((m) => m.to === user.email)!.text);
    const rows = await db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.identifier, user.email));
    expect(rows).toHaveLength(1);
    const ttl = rows[0].expires.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(14 * 60_000);
    expect(ttl).toBeLessThanOrEqual(15 * 60_000);
    await db
      .update(verificationTokens)
      .set({ expires: new Date(Date.now() - 1000) })
      .where(eq(verificationTokens.identifier, user.email));
    const res = await click(url);
    expect(res.headers.get("location")).toMatch(/error/i);
    expect((res.headers.getSetCookie?.() ?? []).join("\n")).not.toContain(
      "authjs.session-token=",
    );
  });

  it("unknown email: identical response, nothing emailed, no account created", async () => {
    const { user } = await seedCompany(db);
    const known = await requestLink(user.email);
    const unknownEmail = `ghost-${uid()}@example.test`;
    const unknown = await requestLink(unknownEmail);
    expect(unknown.status).toBe(known.status);
    expect(unknown.headers.get("location")).toBe(known.headers.get("location"));
    expect(mails().filter((m) => m.to === unknownEmail)).toHaveLength(0);
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, unknownEmail));
    expect(rows).toHaveLength(0);
  });
});
