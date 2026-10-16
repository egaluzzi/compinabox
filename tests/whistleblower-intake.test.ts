// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { POST as submitReport } from "@/app/api/report/[slug]/route";
import { POST as statusLookup } from "@/app/api/report/[slug]/status/route";
import { GET as serveUpload } from "@/app/uploads/[name]/route";
import {
  waitlistLeads,
  whistleblowerEvidence,
  whistleblowerReports,
} from "@/lib/db/schema";
import { aadFor, decryptBytes, decryptText } from "@/lib/whistleblower/crypto";
import {
  assertEvidenceDirSeparate,
  evidenceDir,
} from "@/lib/whistleblower/evidence";
import { storeReport } from "@/lib/whistleblower/intake";
import {
  generateTrackingCode,
  normalizeTrackingCode,
} from "@/lib/whistleblower/tracking-code";
import { uploadsDir } from "@/lib/uploads";
import { seedCompany, uid, useTestDb } from "./helpers/db";
import {
  jpegWithMarker,
  pngWithMarker,
  reportRequest,
  slugCtx,
} from "./helpers/whistleblower";

let db: ReturnType<typeof useTestDb>;
type Seeded = Awaited<ReturnType<typeof seedCompany>>;
let A: Seeded;
let B: Seeded;
let outbox: string;

const MARKERS = [
  "203.0.113.77", // x-forwarded-for
  "198.51.100.9", // cf-connecting-ip
  "AnonProbe/9.9", // user-agent
  "session-cookie-MARKER-42", // cookie value
  "es-XX-MARKER", // accept-language
  "https://referer.example/MARKER-REFERER",
];
const PROBE_HEADERS = {
  "x-forwarded-for": "203.0.113.77, 10.0.0.1",
  "cf-connecting-ip": "198.51.100.9",
  "user-agent": "AnonProbe/9.9",
  cookie: "sid=session-cookie-MARKER-42",
  "accept-language": "es-XX-MARKER",
  referer: "https://referer.example/MARKER-REFERER",
};
const FIELDS = {
  category: "fraud",
  description: "Descrição secreta única 7f3a",
  wantsContact: "no",
};

beforeAll(async () => {
  db = useTestDb();
  outbox = mkdtempSync(path.join(tmpdir(), "outbox-"));
});
beforeEach(async () => {
  vi.stubEnv("EMAIL_DEV_SINK", "true");
  vi.stubEnv("EMAIL_SINK_DIR", outbox);
  A = await seedCompany(db, `wa-${uid()}`);
  B = await seedCompany(db, `wb-${uid()}`);
});
afterEach(() => vi.unstubAllEnvs());

const reportsOf = (companyId: string) =>
  db
    .select()
    .from(whistleblowerReports)
    .where(eq(whistleblowerReports.companyId, companyId));
const evidenceFiles = () => readdirSync(evidenceDir());

/** Every text-like column of every table in the public schema, searched for each marker. */
async function searchWholeDatabase(markers: string[]) {
  const cols = await db.execute<{
    table_name: string;
    column_name: string;
  }>(sql`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and data_type in ('text', 'character varying', 'character', 'jsonb', 'json')`);
  const found: string[] = [];
  for (const { table_name, column_name } of cols.rows)
    for (const m of markers) {
      const r = await db.execute<{ n: string }>(
        sql.raw(
          `select count(*) as n from "${table_name}" where "${column_name}"::text ilike '%' || '${m.replace(/'/g, "''")}' || '%'`,
        ),
      );
      if (Number(r.rows[0].n) > 0)
        found.push(`${table_name}.${column_name} ~ ${m}`);
    }
  return { found, columns: cols.rows.length };
}

describe("anonymous intake", () => {
  it("stores nothing about the request: marker headers appear in no column of any table", async () => {
    const res = await submitReport(
      reportRequest(A.company.slug, FIELDS, [], PROBE_HEADERS),
      slugCtx(A.company.slug),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(res.headers.get("set-cookie")).toBeNull();

    const [row] = await reportsOf(A.company.id);
    expect(row.isAnonymous).toBe(true);
    expect(row.reporterContact).toBeNull();
    expect(row.status).toBe("new");
    expect(row.trackingCode).toBe(normalizeTrackingCode(body.code));
    // the description is ciphertext and decrypts to what was sent (bound to this tenant+column)
    expect(row.description).toMatch(/^vt1:/);
    expect(row.description).not.toContain("secreta");
    expect(
      decryptText(
        row.description,
        aadFor("whistleblower_reports", A.company.id, "description"),
      ),
    ).toBe(FIELDS.description);

    const empty = await searchWholeDatabase(MARKERS);
    expect(empty.columns).toBeGreaterThan(20); // not vacuous: many columns were searched
    expect(empty.found).toEqual([]);

    // positive control: the same search DOES find a marker that is really in the database
    const [lead] = await db
      .insert(waitlistLeads)
      .values({
        email: `ctrl-${uid()}-203.0.113.77@example.test`,
        country: "br",
      })
      .returning();
    const control = await searchWholeDatabase(MARKERS);
    expect(control.found).toEqual(["waitlist_leads.email ~ 203.0.113.77"]);
    await db.delete(waitlistLeads).where(eq(waitlistLeads.id, lead.id));
  });

  it("sends the public no-cache / no-referrer / no-frame / noindex headers on success and on errors", async () => {
    for (const res of [
      await submitReport(
        reportRequest(A.company.slug, FIELDS),
        slugCtx(A.company.slug),
      ),
      await submitReport(
        reportRequest(A.company.slug, { category: "x" }),
        slugCtx(A.company.slug),
      ),
      await submitReport(
        reportRequest("no-such-company", FIELDS),
        slugCtx("no-such-company"),
      ),
    ]) {
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("content-security-policy")).toBe(
        "frame-ancestors 'none'",
      );
      expect(res.headers.get("x-robots-tag")).toContain("noindex");
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("contact details are stored only on opt-in, encrypted, with is_anonymous = false", async () => {
    const res = await submitReport(
      reportRequest(A.company.slug, {
        ...FIELDS,
        wantsContact: "yes",
        contact: "joana@example.test / +55 11 99999-0000",
      }),
      slugCtx(A.company.slug),
    );
    expect(res.status).toBe(201);
    const [row] = await reportsOf(A.company.id);
    expect(row.isAnonymous).toBe(false);
    expect(row.reporterContact).toMatch(/^vt1:/);
    expect(row.reporterContact).not.toContain("joana");
    expect(
      decryptText(
        row.reporterContact!,
        aadFor("whistleblower_reports", A.company.id, "reporter_contact"),
      ),
    ).toBe("joana@example.test / +55 11 99999-0000");
  });

  it("a contact value sent without opting in is ignored", async () => {
    await submitReport(
      reportRequest(A.company.slug, {
        ...FIELDS,
        wantsContact: "no",
        contact: "nope@example.test",
      }),
      slugCtx(A.company.slug),
    );
    const [row] = await reportsOf(A.company.id);
    expect(row.reporterContact).toBeNull();
    expect(row.isAnonymous).toBe(true);
  });

  it("validates input with fixed 422 codes and stores nothing", async () => {
    const cases: [Record<string, string>, string][] = [
      [{ ...FIELDS, category: "gossip" }, "category"],
      [{ ...FIELDS, category: "" }, "category"],
      [{ ...FIELDS, description: "   " }, "description"],
      [{ ...FIELDS, description: "x".repeat(10_001) }, "description"],
      [{ ...FIELDS, wantsContact: "yes", contact: "" }, "contact"],
      [{ ...FIELDS, wantsContact: "yes", contact: "c".repeat(255) }, "contact"],
    ];
    for (const [fields, error] of cases) {
      const res = await submitReport(
        reportRequest(A.company.slug, fields),
        slugCtx(A.company.slug),
      );
      expect([res.status, (await res.json()).error]).toEqual([422, error]);
    }
    expect(await reportsOf(A.company.id)).toHaveLength(0);
    // boundaries are accepted: 10,000-char description, 254-char contact
    const ok = await submitReport(
      reportRequest(A.company.slug, {
        ...FIELDS,
        description: "x".repeat(10_000),
        wantsContact: "yes",
        contact: "c".repeat(254),
      }),
      slugCtx(A.company.slug),
    );
    expect(ok.status).toBe(201);
  });

  it("a filled honeypot looks like a success but stores nothing", async () => {
    const res = await submitReport(
      reportRequest(A.company.slug, {
        ...FIELDS,
        website: "http://spam.example",
      }),
      slugCtx(A.company.slug),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).code).toMatch(
      /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/,
    );
    expect(await reportsOf(A.company.id)).toHaveLength(0);
  });

  it("an unknown company slug is a 404 and stores nothing", async () => {
    const res = await submitReport(
      reportRequest("nobody-here", FIELDS),
      slugCtx("nobody-here"),
    );
    expect([res.status, await res.json()]).toEqual([
      404,
      { error: "not_found" },
    ]);
  });

  it("each report gets a distinct tracking code", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await submitReport(
        reportRequest(A.company.slug, FIELDS),
        slugCtx(A.company.slug),
      );
      codes.add((await res.json()).code);
    }
    expect(codes.size).toBe(5);
  });
});

describe("tracking code collisions", () => {
  const submission = {
    category: "fraud" as const,
    description: "d",
    contact: null,
    images: [],
  };

  it("a collision on the unique code is retried with a fresh code", async () => {
    const taken = generateTrackingCode();
    await storeReport(db, A.company.id, submission, () => taken);
    const fresh = generateTrackingCode();
    const codes = [taken, taken, fresh];
    const code = await storeReport(db, A.company.id, submission, () =>
      codes.shift()!,
    );
    expect(code).toBe(fresh);
    expect(await reportsOf(A.company.id)).toHaveLength(2);
  });

  it("persistent collisions give up with an error — and the encrypted evidence files are removed again", async () => {
    const taken = generateTrackingCode();
    await storeReport(db, A.company.id, submission, () => taken);
    const before = evidenceFiles().length;
    await expect(
      storeReport(
        db,
        A.company.id,
        {
          ...submission,
          images: [{ bytes: pngWithMarker("x"), contentType: "image/png" }],
        },
        () => taken,
      ),
    ).rejects.toThrow();
    expect(evidenceFiles().length).toBe(before);
    expect(await reportsOf(A.company.id)).toHaveLength(1);
  });
});

describe("status lookup", () => {
  const lookup = (slug: string, code: unknown) =>
    statusLookup(
      new Request(`http://localhost/api/report/${slug}/status`, {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
      slugCtx(slug),
    );
  const raw = async (res: Response) => [res.status, await res.text()] as const;

  it("returns only the status label and date; wrong, malformed, unknown-company and cross-company lookups are byte-identical", async () => {
    const res = await submitReport(
      reportRequest(A.company.slug, FIELDS),
      slugCtx(A.company.slug),
    );
    const { code } = await res.json();

    const ok = await lookup(A.company.slug, code);
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(Object.keys(body).sort()).toEqual(["date", "label", "status"]);
    expect(body.status).toBe("new");
    expect(body.label).toBe("Recebida"); // company country br -> pt-BR
    expect(JSON.stringify(body)).not.toMatch(
      /fraud|secreta|category|description/,
    );
    // lower case / no dashes are accepted
    expect(
      (await lookup(A.company.slug, code.toLowerCase().replace(/-/g, " ")))
        .status,
    ).toBe(200);

    const wrong = await raw(await lookup(A.company.slug, "AAAA-AAAA-AAAA"));
    const malformed = await raw(await lookup(A.company.slug, "12"));
    const notAString = await raw(await lookup(A.company.slug, { a: 1 }));
    const unknownSlug = await raw(await lookup("not-a-company", code));
    const otherTenant = await raw(await lookup(B.company.slug, code)); // A's code on B's slug
    const badJson = await raw(
      await statusLookup(
        new Request("http://localhost/x", { method: "POST", body: "{nope" }),
        slugCtx(A.company.slug),
      ),
    );
    expect(wrong).toEqual([404, '{"error":"not_found"}']);
    for (const other of [
      malformed,
      notAString,
      unknownSlug,
      otherTenant,
      badJson,
    ])
      expect(other).toEqual(wrong);
  });

  it("is rate limited per slug (429), and other slugs are not affected", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/report/[slug]/status/route");
    const hit = (slug: string) =>
      POST(
        new Request("http://localhost/x", {
          method: "POST",
          body: JSON.stringify({ code: "AAAA-AAAA-AAAA" }),
        }),
        slugCtx(slug),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++)
      statuses.push((await hit(A.company.slug)).status);
    expect(statuses).toEqual([...Array(10).fill(404), 429, 429]);
    expect((await hit(A.company.slug)).headers.get("retry-after")).toBe("60");
    expect((await hit(B.company.slug)).status).toBe(404); // B has its own budget
  });

  it("submissions are rate limited per slug too (20 per hour)", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/report/[slug]/route");
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++)
      statuses.push(
        (
          await POST(
            reportRequest(A.company.slug, { category: "x" }),
            slugCtx(A.company.slug),
          )
        ).status,
      );
    expect(statuses.slice(0, 20).every((s) => s === 422)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
    expect(
      (
        await POST(
          reportRequest(B.company.slug, { category: "x" }),
          slugCtx(B.company.slug),
        )
      ).status,
    ).toBe(422);
  });
});

describe("evidence", () => {
  const png = (name = "client-chosen-secret-name.png") => ({
    name,
    bytes: pngWithMarker("GPS-LATITUDE-MARKER"),
    type: "image/png",
  });

  it("is stripped, encrypted on disk (not an image), stored under a server-chosen name, and round-trips", async () => {
    const before = new Set(evidenceFiles());
    const res = await submitReport(
      reportRequest(A.company.slug, FIELDS, [
        png(),
        {
          name: "photo.jpg",
          bytes: jpegWithMarker("EXIF-GPS-MARKER"),
          type: "image/jpeg",
        },
      ]),
      slugCtx(A.company.slug),
    );
    expect(res.status).toBe(201);
    const rows = await db
      .select()
      .from(whistleblowerEvidence)
      .where(eq(whistleblowerEvidence.companyId, A.company.id));
    expect(rows.map((r) => r.contentType).sort()).toEqual([
      "image/jpeg",
      "image/png",
    ]);
    const added = evidenceFiles().filter((f) => !before.has(f));
    expect(added.sort()).toEqual(rows.map((r) => r.fileName).sort());
    for (const r of rows) {
      expect(r.fileName).toMatch(/^[a-f0-9]{32}\.enc$/);
      expect(JSON.stringify(r)).not.toMatch(/client-chosen|photo\.jpg/);
      const onDisk = readFileSync(path.join(evidenceDir(), r.fileName));
      // not an image on disk
      expect(
        onDisk.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      ).toBe(false);
      expect(onDisk[0] === 0xff && onDisk[1] === 0xd8).toBe(false);
      expect(onDisk.toString("latin1")).not.toMatch(/MARKER/);
      const plain = decryptBytes(
        onDisk.toString("utf8"),
        aadFor("whistleblower_evidence", A.company.id, `file:${r.id}`),
      );
      expect(plain.toString("latin1")).not.toMatch(/MARKER/);
      expect(plain.length).toBe(r.sizeBytes);
      // a file moved to another tenant does not decrypt
      expect(() =>
        decryptBytes(
          onDisk.toString("utf8"),
          aadFor("whistleblower_evidence", B.company.id, `file:${r.id}`),
        ),
      ).toThrow();
    }
  });

  it("rejects a 4th file, an oversize file, a non-image, an unparsable image — creating no report and no file", async () => {
    const before = evidenceFiles().length;
    const cases: [
      { name: string; bytes: Uint8Array; type?: string }[],
      string,
    ][] = [
      [[png(), png(), png(), png()], "too_many_files"],
      [
        [
          {
            name: "big.png",
            bytes: Buffer.concat([
              pngWithMarker("x"),
              Buffer.alloc(5 * 1024 * 1024),
            ]),
          },
        ],
        "file_too_large",
      ],
      [[{ name: "a.png", bytes: Buffer.from("GIF89a....") }], "file_type"],
      [
        [{ name: "a.png", bytes: Buffer.from("<svg onload=alert(1)/>") }],
        "file_type",
      ],
      [
        [
          {
            name: "a.png",
            bytes: Buffer.concat([
              Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
              Buffer.from("garbage not chunks"),
            ]),
          },
        ],
        "file_invalid",
      ],
      [
        [
          png(),
          {
            name: "b.jpg",
            bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0]),
          },
        ],
        "file_invalid",
      ],
    ];
    for (const [files, error] of cases) {
      const res = await submitReport(
        reportRequest(A.company.slug, FIELDS, files),
        slugCtx(A.company.slug),
      );
      expect([res.status, (await res.json()).error]).toEqual([422, error]);
    }
    expect(await reportsOf(A.company.id)).toHaveLength(0);
    expect(evidenceFiles().length).toBe(before);
    // exactly 3 files of exactly the maximum size class are fine
    const ok = await submitReport(
      reportRequest(A.company.slug, FIELDS, [png(), png(), png()]),
      slugCtx(A.company.slug),
    );
    expect(ok.status).toBe(201);
  });

  it("an empty file input (no evidence chosen) is not an error", async () => {
    const res = await submitReport(
      reportRequest(A.company.slug, FIELDS, [
        { name: "", bytes: new Uint8Array(0) },
      ]),
      slugCtx(A.company.slug),
    );
    expect(res.status).toBe(201);
  });

  it("lives in a different directory from the public uploads, which can never serve it", async () => {
    expect(evidenceDir()).not.toBe(uploadsDir());
    expect(path.relative(uploadsDir(), evidenceDir()).startsWith("..")).toBe(
      true,
    );
    expect(path.relative(evidenceDir(), uploadsDir()).startsWith("..")).toBe(
      true,
    );
    // the defaults, with nothing configured, are distinct sibling directories too
    vi.stubEnv("EVIDENCE_DIR", "");
    vi.stubEnv("UPLOADS_DIR", "");
    expect(evidenceDir()).not.toBe(uploadsDir());
    expect(evidenceDir().startsWith(uploadsDir() + path.sep)).toBe(false);
    vi.unstubAllEnvs();

    // misconfiguration is refused outright
    vi.stubEnv("UPLOADS_DIR", path.join(evidenceDir(), "uploads"));
    expect(() => assertEvidenceDirSeparate()).toThrow(/separate/);
    vi.stubEnv("UPLOADS_DIR", path.dirname(evidenceDir()));
    expect(() => assertEvidenceDirSeparate()).toThrow(/separate/);
    vi.unstubAllEnvs();

    // the public uploads route cannot return an evidence file, by any name
    await submitReport(
      reportRequest(A.company.slug, FIELDS, [png()]),
      slugCtx(A.company.slug),
    );
    for (const f of evidenceFiles().slice(0, 5)) {
      for (const name of [
        f,
        f.replace(/\.enc$/, ".png"),
        f.replace(/\.enc$/, ".jpg"),
      ]) {
        const r = await serveUpload(new Request("http://localhost/uploads/x"), {
          params: Promise.resolve({ name }),
        });
        expect(r.status).toBe(404);
      }
    }
  });
});

describe("notification email", () => {
  const sent = () =>
    readdirSync(outbox).map((f) =>
      JSON.parse(readFileSync(path.join(outbox, f), "utf8")),
    );

  it("goes to the company's admin, links to the dashboard and carries no report content", async () => {
    const before = sent().length;
    const res = await submitReport(
      reportRequest(A.company.slug, { ...FIELDS, category: "harassment" }),
      slugCtx(A.company.slug),
    );
    const { code } = await res.json();
    const [row] = await reportsOf(A.company.id);
    const mails = sent()
      .slice(before)
      .filter((m) => m.to === A.user.email);
    expect(mails).toHaveLength(1);
    expect(
      sent()
        .slice(before)
        .filter((m) => m.to === B.user.email),
    ).toHaveLength(0);
    const m = mails[0];
    expect(m.subject).toBe("Nova denúncia recebida no seu canal");
    expect(m.text).toContain("/dashboard/whistleblower");
    const everything = JSON.stringify(m);
    for (const leak of [
      "harassment",
      "Assédio",
      "secreta",
      code,
      code.replace(/-/g, ""),
      row.trackingCode,
      row.id,
    ])
      expect(everything, leak).not.toContain(leak);
    expect(everything).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/); // no timestamp
  });

  it("an email failure never fails the submission or loses the report", async () => {
    vi.stubEnv("EMAIL_DEV_SINK", "false");
    vi.stubEnv("RESEND_API_KEY", "");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await submitReport(
      reportRequest(A.company.slug, FIELDS),
      slugCtx(A.company.slug),
    );
    expect(res.status).toBe(201);
    expect(await reportsOf(A.company.id)).toHaveLength(1);
    expect(logged.mock.calls).toEqual([["report notification email failed"]]); // a fixed string only
    logged.mockRestore();
  });
});
