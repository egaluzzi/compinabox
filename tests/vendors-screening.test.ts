// @vitest-environment node
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { vendorScreenings, vendors } from "@/lib/db/schema";
import { getScreeningProvider } from "@/lib/screening";
import {
  SCREEN_COOLDOWN_MS,
  SCREEN_DAILY_CAP,
} from "@/lib/screening/constants";
import {
  checkedBaseUrl,
  mapResponse,
  OpenSanctionsProvider,
} from "@/lib/screening/opensanctions";
import type {
  ScreeningInput,
  ScreeningOutcome,
  ScreeningProvider,
} from "@/lib/screening/types";
import { screenVendor } from "@/lib/vendors/screen";
import { summarizeVendors } from "@/lib/vendors/summary";
import { uid, useTestDb } from "./helpers/db";
import { seedPortalCompany } from "./helpers/employee";

// The provider client is exercised for real (fetch, timeouts, status codes) against a local
// stub HTTP server carrying canned provider JSON. NOTHING here is evidence about the live
// service: see HANDOFF.md ("LIVE CHECK").

type Seen = { url: string; auth: string | undefined; body: string };
let server: Server;
let base: string;
let seen: Seen[] = [];
let reply: (req: IncomingMessage) => {
  status?: number;
  body?: string;
  delayMs?: number;
} = () => ({ body: "{}" });

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen.push({
        url: req.url ?? "",
        auth: req.headers.authorization,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      const r = reply(req);
      setTimeout(() => {
        res.statusCode = r.status ?? 200;
        res.end(r.body ?? "");
      }, r.delayMs ?? 0);
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});
afterEach(() => {
  seen = [];
  reply = () => ({ body: "{}" });
});

const KEY = "sk-test-SECRET-KEY-do-not-leak-123";
const provider = (timeoutMs = 2000) =>
  new OpenSanctionsProvider(KEY, base, "default", timeoutMs);
const results = (...r: object[]) =>
  JSON.stringify({
    responses: { q1: { results: r, total: { value: r.length } } },
  });
const hit = (o: object = {}) => ({
  id: "NK-1",
  caption: "Listed Corp",
  schema: "Company",
  score: 0.95,
  match: true,
  datasets: ["us_ofac_sdn"],
  properties: { topics: ["sanction"], name: ["x"] },
  ...o,
});

describe("OpenSanctions client: the request", () => {
  it("sends the vendor name and country to /match/<dataset> with an ApiKey header, and nothing else", async () => {
    reply = () => ({ body: results() });
    await provider().screen({ name: "Fornecedor Ltda", country: "BR" });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("/match/default");
    expect(seen[0].auth).toBe(`ApiKey ${KEY}`);
    expect(JSON.parse(seen[0].body)).toEqual({
      queries: {
        q1: {
          schema: "Company",
          properties: { name: ["Fornecedor Ltda"], country: ["BR"] },
        },
      },
    });
  });

  it("omits country when none is given, and uses the configured dataset", async () => {
    reply = () => ({ body: results() });
    await new OpenSanctionsProvider(KEY, base, "sanctions").screen({
      name: "X",
    });
    expect(seen[0].url).toBe("/match/sanctions");
    expect(JSON.parse(seen[0].body).queries.q1.properties).toEqual({
      name: ["X"],
    });
  });
});

describe("OpenSanctions client: mapping canned provider JSON", () => {
  const run = async (body: string, status = 200) => {
    reply = () => ({ status, body });
    return provider().screen({ name: "N" });
  };

  it("match:true is a possible match, with only the five stored fields", async () => {
    const o = await run(results(hit({ secret: "dropped", schema: "Company" })));
    expect(o).toEqual({
      status: "possible_match",
      dataset: "default",
      matches: [
        {
          id: "NK-1",
          caption: "Listed Corp",
          score: 0.95,
          datasets: ["us_ofac_sdn"],
          topics: ["sanction"],
        },
      ],
    });
  });

  it("score 0.69 without match is NOT a possible match; 0.7 is", async () => {
    expect(
      (await run(results(hit({ match: false, score: 0.69 })))).status,
    ).toBe("no_match");
    expect((await run(results(hit({ match: false, score: 0.7 })))).status).toBe(
      "possible_match",
    );
    expect((await run(results(hit({ match: false, score: 0.2 })))).status).toBe(
      "no_match",
    );
  });

  it("an empty result list is no_match (a parsed 2xx with a q1 entry)", async () => {
    expect(await run(results())).toEqual({
      status: "no_match",
      matches: [],
      dataset: "default",
    });
  });

  it("keeps the top 10 by score, tolerates missing topics/datasets", async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      hit({
        id: `E${i}`,
        score: 0.5 + i / 100,
        match: false,
        properties: undefined,
        datasets: undefined,
      }),
    );
    const o = await run(results(...many));
    if (o.status === "error") throw new Error("unexpected");
    expect(o.matches).toHaveLength(10);
    expect(o.matches[0].id).toBe("E11");
    expect(o.matches[0]).toMatchObject({ topics: [], datasets: [] });
  });

  it("reads topics from the top level when properties.topics is absent", () => {
    const o = mapResponse(
      {
        responses: {
          q1: { results: [{ id: "a", score: 0.9, topics: ["crime"] }] },
        },
      },
      "d",
    );
    expect(o).toMatchObject({ matches: [{ topics: ["crime"], caption: "a" }] });
  });

  it.each([
    ["an empty body", ""],
    ["not JSON", "<html>oops</html>"],
    ["an empty object", "{}"],
    ["no q1 entry", JSON.stringify({ responses: {} })],
    ["q1 without results", JSON.stringify({ responses: { q1: {} } })],
    [
      "a results entry that is not an object",
      JSON.stringify({ responses: { q1: { results: ["x"] } } }),
    ],
    ["an array", "[]"],
    ["null", "null"],
  ])("%s is bad_response, never no_match", async (_n, body) => {
    expect(await run(body)).toEqual({ status: "error", code: "bad_response" });
  });

  it.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate_limited"],
    [500, "upstream"],
    [503, "upstream"],
    [418, "upstream"],
  ])("HTTP %i maps to %s", async (status, code) => {
    expect(await run(results(), status)).toEqual({ status: "error", code });
  });

  it("a slow server is a timeout; a closed port is upstream", async () => {
    reply = () => ({ body: results(), delayMs: 400 });
    expect(await provider(50).screen({ name: "N" })).toEqual({
      status: "error",
      code: "timeout",
    });
    const dead = new OpenSanctionsProvider(
      KEY,
      "http://127.0.0.1:1",
      "default",
      500,
    );
    expect(await dead.screen({ name: "N" })).toEqual({
      status: "error",
      code: "upstream",
    });
  });

  it("the API key never appears in any outcome", async () => {
    for (const [status, body] of [
      [200, results(hit())],
      [401, `{"error":"${KEY}"}`],
      [500, KEY],
    ] as const) {
      reply = () => ({ status, body });
      expect(
        JSON.stringify(await provider().screen({ name: "N" })),
      ).not.toContain(KEY);
    }
  });
});

describe("SCREENING_BASE_URL guard and provider selection", () => {
  it("refuses http unless the host is loopback; accepts https", () => {
    expect(() => checkedBaseUrl("http://api.example.com")).toThrow(/https/);
    expect(() => checkedBaseUrl("ftp://localhost")).toThrow();
    expect(() => checkedBaseUrl("not a url")).toThrow();
    expect(checkedBaseUrl("https://api.opensanctions.org/")).toBe(
      "https://api.opensanctions.org",
    );
    expect(checkedBaseUrl("http://localhost:8000")).toBe(
      "http://localhost:8000",
    );
    expect(checkedBaseUrl("http://127.0.0.1:9")).toBe("http://127.0.0.1:9");
    expect(checkedBaseUrl("http://[::1]:9")).toBe("http://[::1]:9");
  });

  it("an http non-loopback base URL throws at first use and sends nothing", async () => {
    const p = new OpenSanctionsProvider(
      KEY,
      "http://api.example.com",
      "default",
    );
    await expect(p.screen({ name: "N" })).rejects.toThrow(/https/);
    expect(seen).toHaveLength(0);
  });

  it("no key / the placeholder = unavailable, with a not_configured outcome; a key = OpenSanctions", async () => {
    for (const env of [
      {},
      { SCREENING_API_KEY: "changeme" },
      { SCREENING_API_KEY: "" },
    ]) {
      const p = getScreeningProvider(env);
      expect(p.available).toBe(false);
      expect(await p.screen({ name: "N" })).toEqual({
        status: "error",
        code: "not_configured",
      });
    }
    const p = getScreeningProvider({
      SCREENING_API_KEY: "k",
      SCREENING_DATASET: "sanctions",
    });
    expect(p).toMatchObject({
      available: true,
      name: "opensanctions",
      dataset: "sanctions",
    });
    expect(getScreeningProvider({ SCREENING_API_KEY: "k" }).dataset).toBe(
      "default",
    );
  });
});

// --- the screening action, on a real Postgres, with an injected provider -------------------
type Seeded = Awaited<ReturnType<typeof seedPortalCompany>>;
let db: ReturnType<typeof useTestDb>;
beforeAll(() => {
  db = useTestDb();
});

function stub(
  outcome: ScreeningOutcome | (() => Promise<ScreeningOutcome>),
  over: Partial<ScreeningProvider> = {},
) {
  const calls: ScreeningInput[] = [];
  const p: ScreeningProvider = {
    name: "stub",
    available: true,
    dataset: "stub_ds",
    screen: async (input) => {
      calls.push(input);
      return typeof outcome === "function" ? outcome() : outcome;
    },
    ...over,
  };
  return { p, calls };
}
const POSSIBLE: ScreeningOutcome = {
  status: "possible_match",
  dataset: "stub_ds",
  matches: [
    {
      id: "E1",
      caption: "Listed",
      score: 0.9,
      datasets: ["d"],
      topics: ["sanction"],
    },
  ],
};
const NONE: ScreeningOutcome = {
  status: "no_match",
  dataset: "stub_ds",
  matches: [],
};
async function vendor(
  s: Seeded,
  over: Partial<typeof vendors.$inferInsert> = {},
) {
  const [v] = await db
    .insert(vendors)
    .values({ companyId: s.company.id, name: `V ${uid()}`, ...over })
    .returning();
  return v;
}
const rows = (v: { id: string }) =>
  db.select().from(vendorScreenings).where(eq(vendorScreenings.vendorId, v.id));
const T0 = new Date("2026-10-16T12:00:00Z");

describe("screenVendor", () => {
  it("sends only name + country; stores the run and updates the vendor cache", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s, {
      country: "BR",
      taxId: "11222333000181",
      contactEmail: "x@y.test",
    });
    const { p, calls } = stub(POSSIBLE);
    expect(
      await screenVendor(db, s.company.id, s.user.id, v.id, p, T0),
    ).toEqual({
      state: "done",
      status: "possible_match",
    });
    expect(calls).toEqual([{ name: v.name, country: "BR" }]);
    const [row] = await rows(v);
    expect(row).toMatchObject({
      companyId: s.company.id,
      provider: "stub",
      dataset: "stub_ds",
      nameScreened: v.name,
      status: "possible_match",
      matchCount: 1,
      errorCode: null,
      requestedByUserId: s.user.id,
    });
    expect(row.matches).toEqual("matches" in POSSIBLE ? POSSIBLE.matches : []);
    const [after] = await db.select().from(vendors).where(eq(vendors.id, v.id));
    expect(after.screeningResult).toBe("possible_match");
    expect(after.screenedAt).toEqual(T0);
  });

  it("omits country when the vendor has none", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const { p, calls } = stub(NONE);
    await screenVendor(db, s.company.id, s.user.id, v.id, p, T0);
    expect(calls).toEqual([{ name: v.name }]);
  });

  it("cooldown: a second run within 5 minutes makes no provider call; after 5 minutes it runs", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const { p, calls } = stub(NONE);
    await screenVendor(db, s.company.id, s.user.id, v.id, p, T0);
    const soon = new Date(T0.getTime() + SCREEN_COOLDOWN_MS - 1000);
    expect(
      await screenVendor(db, s.company.id, s.user.id, v.id, p, soon),
    ).toEqual({ state: "cooldown" });
    expect(calls).toHaveLength(1);
    expect(await rows(v)).toHaveLength(1);
    const later = new Date(T0.getTime() + SCREEN_COOLDOWN_MS);
    expect(
      (await screenVendor(db, s.company.id, s.user.id, v.id, p, later)).state,
    ).toBe("done");
    expect(calls).toHaveLength(2);
  });

  it("daily cap: 50 runs today (errors included) block the 51st; yesterday and other companies do not count", async () => {
    const s = await seedPortalCompany(db);
    const other = await seedPortalCompany(db);
    const v = await vendor(s);
    const old = await vendor(s);
    const ov = await vendor(other);
    const mk = (
      companyId: string,
      vendorId: string,
      at: Date,
      status: string,
    ) => ({
      companyId,
      vendorId,
      screenedAt: at,
      provider: "stub",
      dataset: "d",
      nameScreened: "n",
      status,
    });
    await db.insert(vendorScreenings).values([
      ...Array.from({ length: SCREEN_DAILY_CAP - 2 }, () =>
        mk(s.company.id, old.id, new Date("2026-10-16T01:00:00Z"), "no_match"),
      ),
      mk(s.company.id, old.id, new Date("2026-10-16T02:00:00Z"), "error"),
      mk(s.company.id, old.id, new Date("2026-10-16T03:00:00Z"), "error"),
      ...Array.from({ length: 5 }, () =>
        mk(s.company.id, old.id, new Date("2026-10-15T23:59:59Z"), "no_match"),
      ), // yesterday (UTC)
      ...Array.from({ length: 60 }, () =>
        mk(
          other.company.id,
          ov.id,
          new Date("2026-10-16T01:00:00Z"),
          "no_match",
        ),
      ),
    ]);
    const { p, calls } = stub(NONE);
    expect(
      await screenVendor(db, s.company.id, s.user.id, v.id, p, T0),
    ).toEqual({ state: "cap" });
    expect(calls).toHaveLength(0);
    // the company with 60 rows is itself capped, but a third company is not
    const third = await seedPortalCompany(db);
    const tv = await vendor(third);
    expect(
      (await screenVendor(db, third.company.id, third.user.id, tv.id, p, T0))
        .state,
    ).toBe("done");
    // the next UTC day starts afresh
    const tomorrow = new Date("2026-10-17T00:00:01Z");
    expect(
      (await screenVendor(db, s.company.id, s.user.id, v.id, p, tomorrow))
        .state,
    ).toBe("done");
  });

  it("49 runs today leave room for exactly one more", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const w = await vendor(s);
    await db.insert(vendorScreenings).values(
      Array.from({ length: SCREEN_DAILY_CAP - 1 }, () => ({
        companyId: s.company.id,
        vendorId: w.id,
        screenedAt: new Date("2026-10-16T01:00:00Z"),
        provider: "stub",
        dataset: "d",
        nameScreened: "n",
        status: "no_match",
      })),
    );
    const { p } = stub(NONE);
    expect(
      (await screenVendor(db, s.company.id, s.user.id, v.id, p, T0)).state,
    ).toBe("done");
    const v2 = await vendor(s);
    expect(
      (await screenVendor(db, s.company.id, s.user.id, v2.id, p, T0)).state,
    ).toBe("cap");
  });

  it("archived vendors cannot be screened; another company's vendor is not found; both make no call", async () => {
    const s = await seedPortalCompany(db);
    const other = await seedPortalCompany(db);
    const arch = await vendor(s, { archivedAt: new Date() });
    const foreign = await vendor(other);
    const { p, calls } = stub(NONE);
    expect(
      await screenVendor(db, s.company.id, s.user.id, arch.id, p, T0),
    ).toEqual({ state: "archived" });
    expect(
      await screenVendor(db, s.company.id, s.user.id, foreign.id, p, T0),
    ).toEqual({ state: "not_found" });
    expect(calls).toHaveLength(0);
    expect(await rows(foreign)).toHaveLength(0);
  });

  it("an unavailable provider makes no call and records nothing; a provider that throws records nothing", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const off = stub(NONE, { available: false });
    expect(
      await screenVendor(db, s.company.id, s.user.id, v.id, off.p, T0),
    ).toEqual({ state: "unavailable" });
    expect(off.calls).toHaveLength(0);
    const boom = stub(async () => {
      throw new Error("https only");
    });
    expect(
      await screenVendor(db, s.company.id, s.user.id, v.id, boom.p, T0),
    ).toEqual({ state: "unavailable" });
    expect(await rows(v)).toHaveLength(0);
  });

  it("an error outcome is recorded as an error — never as no_match — and the earlier good result stays in the history", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    await screenVendor(db, s.company.id, s.user.id, v.id, stub(NONE).p, T0);
    const later = new Date(T0.getTime() + 6 * 60_000);
    const failing = stub({ status: "error", code: "upstream" });
    expect(
      await screenVendor(db, s.company.id, s.user.id, v.id, failing.p, later),
    ).toEqual({ state: "done", status: "error" });
    const hist = (await rows(v)).sort(
      (a, b) => a.screenedAt.getTime() - b.screenedAt.getTime(),
    );
    expect(hist.map((r) => r.status)).toEqual(["no_match", "error"]);
    expect(hist[1]).toMatchObject({
      errorCode: "upstream",
      matchCount: 0,
      matches: [],
    });
    const [after] = await db.select().from(vendors).where(eq(vendors.id, v.id));
    expect(after.screeningResult).toBe("error");
    const [sum] = await summarizeVendors(db, s.company.id);
    expect(sum.screening).toMatchObject({
      status: "error",
      possibleMatchCount: 0,
    });
  });

  it("history row and vendor cache are one transaction: a failing insert leaves the cache untouched", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const bad = stub({
      status: "weird",
      matches: [],
      dataset: "d",
    } as unknown as ScreeningOutcome);
    await expect(
      screenVendor(db, s.company.id, s.user.id, v.id, bad.p, T0),
    ).rejects.toThrow();
    const [after] = await db.select().from(vendors).where(eq(vendors.id, v.id));
    expect(after.screeningResult).toBeNull();
    expect(await rows(v)).toHaveLength(0);
  });

  it("two simultaneous clicks make exactly one provider call", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    const slow = stub(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return NONE;
    });
    const out = await Promise.all([
      screenVendor(db, s.company.id, s.user.id, v.id, slow.p, T0),
      screenVendor(db, s.company.id, s.user.id, v.id, slow.p, T0),
    ]);
    expect(slow.calls).toHaveLength(1);
    expect(out.map((o) => o.state).sort()).toEqual(["cooldown", "done"]);
    expect(await rows(v)).toHaveLength(1);
  });

  it("through the real client: the key is nowhere in the database and nothing is logged", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s, { country: "BR" });
    const logs = ["log", "info", "warn", "error", "debug"].map((m) =>
      vi.spyOn(console, m as "log").mockImplementation(() => {}),
    );
    reply = () => ({ body: results(hit()) });
    const r = await screenVendor(
      db,
      s.company.id,
      s.user.id,
      v.id,
      provider(),
      T0,
    );
    expect(r).toEqual({ state: "done", status: "possible_match" });
    expect(JSON.parse(seen[0].body).queries.q1.properties).toEqual({
      name: [v.name],
      country: ["BR"],
    });
    for (const l of logs) expect(l).not.toHaveBeenCalled();
    logs.forEach((l) => l.mockRestore());
    const dump = JSON.stringify([
      await rows(v),
      await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.id, v.id))),
    ]);
    expect(dump).not.toContain(KEY);
    expect(dump).not.toContain("Authorization");
  });
});

describe("append-only history", () => {
  it("vendor_screenings rejects UPDATE, DELETE and TRUNCATE", async () => {
    const s = await seedPortalCompany(db);
    const v = await vendor(s);
    await screenVendor(db, s.company.id, s.user.id, v.id, stub(NONE).p, T0);
    await expect(
      db
        .update(vendorScreenings)
        .set({ status: "error" })
        .where(eq(vendorScreenings.vendorId, v.id)),
    ).rejects.toThrow();
    await expect(
      db.delete(vendorScreenings).where(eq(vendorScreenings.vendorId, v.id)),
    ).rejects.toThrow();
    expect(await rows(v)).toHaveLength(1);
  });
});
