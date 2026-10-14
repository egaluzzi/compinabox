// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/waitlist/route";
import { schema } from "@/lib/db/client";
import { uid, useTestDb } from "./helpers/db";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

let db: ReturnType<typeof useTestDb>;
beforeAll(() => {
  db = useTestDb();
});
afterEach(() => vi.restoreAllMocks());
const rowsFor = (email: string) =>
  db
    .select()
    .from(schema.waitlistLeads)
    .where(eq(schema.waitlistLeads.email, email.toLowerCase()));

describe("POST /api/waitlist (real Postgres)", () => {
  it("stores a valid lead (email, country, timestamp) and logs nothing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const email = `Ana-${uid()}@Example.com`;
    const res = await post({ email, country: "ar" });
    expect(res.status).toBe(200);
    const rows = await rowsFor(email);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "country",
      "createdAt",
      "email",
      "id",
    ]);
    expect(rows[0]).toMatchObject({
      email: email.toLowerCase(),
      country: "ar",
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("a repeat email is a silent no-op with the same response", async () => {
    const email = `dup-${uid()}@example.com`;
    const a = await post({ email, country: "ar" });
    const b = await post({ email: email.toUpperCase(), country: "mx" });
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await rowsFor(email)).toHaveLength(1);
  });

  it.each(["", "nope", "a@b", "a b@c.de", 42, null])(
    "rejects bad email %j",
    async (email) => {
      const before = (await db.select().from(schema.waitlistLeads)).length;
      const res = await post({ email });
      expect(res.status).toBe(422);
      expect((await db.select().from(schema.waitlistLeads)).length).toBe(
        before,
      );
    },
  );

  it("silently drops honeypot hits", async () => {
    const email = `bot-${uid()}@example.com`;
    const res = await post({ email, website: "http://spam" });
    expect(res.status).toBe(200);
    expect(await rowsFor(email)).toHaveLength(0);
  });

  it("rejects malformed bodies", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post("null")).status).toBe(400);
  });

  it("stores and logs no IP, user-agent or header values", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const email = `hdr-${uid()}@example.com`;
    await post(
      { email, country: "br" },
      {
        "x-forwarded-for": "203.0.113.9",
        "cf-connecting-ip": "203.0.113.10",
        "user-agent": "SecretAgent/1.0",
        cookie: "session=abc",
      },
    );
    const stored = JSON.stringify(await rowsFor(email));
    for (const leaked of ["203.0.113", "SecretAgent", "session=abc"])
      expect(stored).not.toContain(leaked);
    expect(log).not.toHaveBeenCalled();
  });

  it("strips control characters from the country before storing it", async () => {
    const email = `ctl-${uid()}@example.com`;
    await post({ email, country: "Peru\nFAKE LOG LINE\r" });
    const [row] = await rowsFor(email);
    expect(row.country).not.toMatch(/[\r\n]/);
  });
});
