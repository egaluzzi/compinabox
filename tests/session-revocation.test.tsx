// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { decode } from "next-auth/jwt";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { companies, users } from "@/lib/db/schema";
import { ensureInitialDocuments, listDocuments } from "@/lib/documents/store";
import { seedCompany, useTestDb } from "./helpers/db";

// Only Auth.js's cookie decoding is replaced: `auth()` returns the session the real `session`
// callback would build from these token claims. getTenant, requireTenant, queries and routes
// below are real, on a real Postgres. The jwt/cookie minting itself is tested separately.
const jwt = vi.hoisted(() => ({
  current: null as {
    userId?: string;
    companyId?: string;
    sat?: number;
  } | null,
}));
vi.mock("@/auth", () => ({
  signOut: vi.fn(),
  auth: async () =>
    jwt.current && {
      user: { id: jwt.current.userId },
      companyId: jwt.current.companyId,
      issuedAtMs: jwt.current.sat,
    },
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/dashboard",
}));

let db: ReturnType<typeof useTestDb>;
let A: Awaited<ReturnType<typeof seedCompany>>;
let docId: string;

beforeAll(async () => {
  db = useTestDb();
  process.env.UPLOADS_DIR = mkdtempSync(path.join(tmpdir(), "revoke-"));
  A = await seedCompany(db);
  await db
    .update(companies)
    .set({
      name: "Revoga Ltda",
      industry: "technology",
      onboardingCompletedAt: new Date(),
    })
    .where(eq(companies.id, A.company.id));
  await ensureInitialDocuments(db, A.company.id, A.user.id);
  docId = (await listDocuments(db, A.company.id))[0].id;
});
beforeEach(async () => {
  await db
    .update(users)
    .set({ sessionsValidAfter: sql`now()` })
    .where(eq(users.id, A.user.id));
  await new Promise((r) => setTimeout(r, 5));
});

const claims = (sat?: number) => ({
  userId: A.user.id,
  companyId: A.company.id,
  sat,
});
const validAfter = async () =>
  (await db.select().from(users).where(eq(users.id, A.user.id)))[0]
    .sessionsValidAfter;

const D = "@/app/(app)/dashboard";
const PAGES: [string, Record<string, unknown>?][] = [
  [`${D}/page`],
  [`${D}/documents/page`, { searchParams: Promise.resolve({}) }],
  [`${D}/employees/page`, { searchParams: Promise.resolve({}) }],
  [`${D}/training/page`],
  [`${D}/whistleblower/page`],
  [`${D}/vendors/page`, { searchParams: Promise.resolve({}) }],
  [`${D}/billing/page`],
  [`${D}/settings/page`, { searchParams: Promise.resolve({}) }],
];
async function render(mod: string, props: Record<string, unknown> = {}) {
  const page = (await import(/* @vite-ignore */ mod)).default;
  const layout = (await import(`${D}/layout`)).default;
  const body = (await page(props)) as ReactNode;
  return renderToStaticMarkup(
    createElement("div", null, await layout({ children: body })),
  );
}
const form = () => {
  const f = new FormData();
  f.set("companyName", "Revoga Ltda");
  f.set("industry", "technology");
  f.set("type", "all");
  return f;
};
async function everySurface() {
  const out: Record<string, string | number> = {};
  for (const [mod, props] of PAGES) {
    out[mod] = await render(mod, props).then(
      () => "ok",
      (e: Error) => e.message,
    );
  }
  const req = (body?: FormData) =>
    new Request("http://localhost/x", { method: body ? "POST" : "GET", body });
  const { GET } = await import(`${D}/documents/[id]/pdf/route`);
  out.pdf = (
    await GET(req(), { params: Promise.resolve({ id: docId }) })
  ).status;
  const save = await import(`${D}/settings/save/route`);
  out.save = (await save.POST(req(form()))).status;
  const regen = await import("@/app/api/documents/regenerate/route");
  out.regenerate = (await regen.POST(req(form()))).status;
  return out;
}

describe("getTenant honours sessions_valid_after", () => {
  it("a session without `sat` is anonymous", async () => {
    jwt.current = claims(undefined);
    const { getTenant } = await import("@/lib/auth/tenant");
    expect(await getTenant()).toBeNull();
  });
  it("sat before sessions_valid_after is anonymous; sat after is valid", async () => {
    const { getTenant } = await import("@/lib/auth/tenant");
    const va = (await validAfter()).getTime();
    jwt.current = claims(va - 1);
    expect(await getTenant()).toBeNull();
    jwt.current = claims(va);
    expect(await getTenant()).toEqual({
      userId: A.user.id,
      companyId: A.company.id,
    });
    jwt.current = claims(Date.now());
    expect(await getTenant()).not.toBeNull();
  });
});

describe("sign-out revokes server-side", () => {
  it("a pre-sign-out session is refused by every section, the PDF, settings/save and regenerate; a later session works", async () => {
    const { getTenant, revokeSessions } = await import("@/lib/auth/tenant");
    const old = Date.now();
    jwt.current = claims(old);
    const before = await everySurface();
    expect(Object.values(before).filter((v) => v === "ok")).toHaveLength(8);
    expect([before.pdf, before.save, before.regenerate]).toEqual([
      200, 303, 303,
    ]);

    const was = await validAfter();
    await new Promise((r) => setTimeout(r, 5));
    await revokeSessions(db, (await getTenant())!);
    expect((await validAfter()).getTime()).toBeGreaterThan(was.getTime());

    const after = await everySurface(); // same cookie replayed
    for (const [mod] of PAGES) expect(after[mod]).toBe("REDIRECT /login");
    expect([after.pdf, after.save, after.regenerate]).toEqual([401, 401, 401]);

    await new Promise((r) => setTimeout(r, 5));
    jwt.current = claims(Date.now()); // signed in again
    const again = await everySurface();
    expect(Object.values(again).filter((v) => v === "ok")).toHaveLength(8);
  });

  it("revoking one user's sessions leaves another user's untouched", async () => {
    const B = await seedCompany(db);
    const { revokeSessions } = await import("@/lib/auth/tenant");
    const bBefore = (
      await db.select().from(users).where(eq(users.id, B.user.id))
    )[0];
    await revokeSessions(db, { userId: A.user.id, companyId: A.company.id });
    const bAfter = (
      await db.select().from(users).where(eq(users.id, B.user.id))
    )[0];
    expect(bAfter.sessionsValidAfter).toEqual(bBefore.sessionsValidAfter);
    // right user id, wrong company: no effect
    const a0 = await validAfter();
    await revokeSessions(db, { userId: A.user.id, companyId: B.company.id });
    expect(await validAfter()).toEqual(a0);
  });
});

describe("minting paths stamp `sat`", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-auth-secret-test-auth-secret-1234");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    vi.stubEnv("APP_URL", "http://localhost:3000");
  });
  it("buildSessionCookie (welcome link and return-token sign-in) carries sat = issue time in ms", async () => {
    const { buildSessionCookie } = await import("@/lib/auth/session");
    const t0 = Date.now();
    const c = await buildSessionCookie({
      id: A.user.id,
      email: A.user.email,
      companyId: A.company.id,
    });
    const tok = await decode({
      token: c.value,
      secret: process.env.AUTH_SECRET!,
      salt: c.name,
    });
    expect(tok?.sat).toBeGreaterThanOrEqual(t0);
    expect(tok?.sat).toBeLessThanOrEqual(Date.now());
    jwt.current = {
      userId: tok?.userId as string,
      companyId: tok?.companyId as string,
      sat: tok?.sat as number,
    };
    const { getTenant } = await import("@/lib/auth/tenant");
    expect(await getTenant()).not.toBeNull(); // valid right after issue
  });
  it("welcome link: the cookie is valid right after issue and the link is single-use", async () => {
    const { createWelcomeToken } = await import("@/lib/auth/links");
    const token = await createWelcomeToken(db, A.user.email);
    const { GET } = await import("@/app/api/welcome/route");
    const url = `http://localhost:3000/api/welcome?token=${encodeURIComponent(token)}`;
    const res = await GET(new Request(url));
    const setCookie = res.headers.get("set-cookie") ?? "";
    const m = /authjs\.session-token=([^;]+)/.exec(setCookie);
    expect(m).not.toBeNull();
    const tok = await decode({
      token: m![1],
      secret: process.env.AUTH_SECRET!,
      salt: "authjs.session-token",
    });
    expect(typeof tok?.sat).toBe("number");
    jwt.current = {
      userId: tok?.userId as string,
      companyId: tok?.companyId as string,
      sat: tok?.sat as number,
    };
    const { getTenant } = await import("@/lib/auth/tenant");
    expect(await getTenant()).not.toBeNull();
    const second = await GET(new Request(url));
    expect(second.headers.get("set-cookie") ?? "").not.toContain(
      "authjs.session-token=",
    );
  });
});
