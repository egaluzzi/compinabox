// @vitest-environment node
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import pg from "pg";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  companies,
  whistleblowerEvidence,
  whistleblowerNotes,
  whistleblowerReports,
} from "@/lib/db/schema";
import { updateCompanySettings } from "@/lib/db/tenant";
import { aadFor, decryptText, keyIdOf } from "@/lib/whistleblower/crypto";
import { uniqueCompanySlug } from "@/lib/whistleblower/company-slug";
import { evidenceDir } from "@/lib/whistleblower/evidence";
import { storeReport } from "@/lib/whistleblower/intake";
import { addNote } from "@/lib/whistleblower/queries";
import { rotate } from "@/lib/whistleblower/rotate";
import { slugify } from "@/lib/whistleblower/slug";
import { scratchDb, seedCompany, uid, useTestDb } from "./helpers/db";
import { pngWithMarker } from "./helpers/whistleblower";

let db: ReturnType<typeof useTestDb>;
beforeAll(() => {
  db = useTestDb();
});

const connect = async (url: string) => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  return c;
};

describe("key rotation script (library function)", () => {
  // Rotation is "every row in the database", so it runs against its own migrated database.
  let scratch: Awaited<ReturnType<typeof scratchDb>>;
  const original = process.env.REPORT_ENCRYPTION_KEYS;
  beforeEach(async () => {
    scratch = await scratchDb();
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    process.env.REPORT_ENCRYPTION_KEYS = original;
    await scratch.drop();
  });

  it("re-encrypts reports, notes and evidence files under the new first key; idempotent; dry run writes nothing; counts only", async () => {
    const { db: sdb, client } = scratch;
    const k1 = randomBytes(32).toString("base64");
    const k2 = randomBytes(32).toString("base64");
    const s = await seedCompany(sdb, `rot-${uid()}`);
    const actor = { companyId: s.company.id, userId: s.user.id };
    vi.stubEnv("REPORT_ENCRYPTION_KEYS", `a:${k1}`);
    const code = await storeReport(sdb, s.company.id, {
      category: "fraud",
      description: "Rotação: descrição única 1b2c",
      contact: "rot@example.test",
      images: [{ bytes: pngWithMarker("x"), contentType: "image/png" }],
    });
    const [report] = await sdb
      .select()
      .from(whistleblowerReports)
      .where(eq(whistleblowerReports.trackingCode, code));
    await addNote(sdb, actor, report.id, "Nota para rodar");
    const [ev] = await sdb
      .select()
      .from(whistleblowerEvidence)
      .where(eq(whistleblowerEvidence.reportId, report.id));
    const file = path.join(evidenceDir(), ev.fileName);
    const diskBefore = readFileSync(file, "utf8");
    expect(keyIdOf(report.description)).toBe("a");
    expect(keyIdOf(diskBefore)).toBe("a");

    // a new key goes FIRST; the old one stays for decryption
    vi.stubEnv("REPORT_ENCRYPTION_KEYS", `b:${k2},a:${k1}`);
    const dry = await rotate(client, { apply: false });
    expect(dry).toEqual({
      seen: { reports: 1, notes: 1, evidence: 1 },
      current: 0,
      rewritten: 4, // description, contact, note body, file
      failed: 0,
    });
    const [afterDry] = await sdb
      .select()
      .from(whistleblowerReports)
      .where(eq(whistleblowerReports.id, report.id));
    expect(afterDry.description).toBe(report.description); // dry run wrote nothing
    expect(readFileSync(file, "utf8")).toBe(diskBefore);

    const applied = await rotate(client, { apply: true });
    expect(applied).toEqual(dry);
    // counts only: nothing in the result carries content
    expect(JSON.stringify(applied)).not.toMatch(
      /Rotação|rot@example|Nota para/,
    );

    const [after] = await sdb
      .select()
      .from(whistleblowerReports)
      .where(eq(whistleblowerReports.id, report.id));
    expect(keyIdOf(after.description)).toBe("b");
    expect(keyIdOf(after.reporterContact!)).toBe("b");
    expect(keyIdOf(readFileSync(file, "utf8"))).toBe("b");
    const [noteRow] = await sdb
      .select()
      .from(whistleblowerNotes)
      .where(eq(whistleblowerNotes.reportId, report.id));
    expect(keyIdOf(noteRow.body!)).toBe("b");
    expect(
      decryptText(
        after.description,
        aadFor("whistleblower_reports", s.company.id, "description"),
      ),
    ).toBe("Rotação: descrição única 1b2c");

    // idempotent: a second run has nothing left to do
    expect(await rotate(client, { apply: true })).toEqual({
      seen: { reports: 1, notes: 1, evidence: 1 },
      current: 4,
      rewritten: 0,
      failed: 0,
    });

    // the old key can now be dropped
    vi.stubEnv("REPORT_ENCRYPTION_KEYS", `b:${k2}`);
    expect(
      decryptText(
        after.description,
        aadFor("whistleblower_reports", s.company.id, "description"),
      ),
    ).toContain("Rotação");

    // the case log is append-only again afterwards (the trigger was only off inside the transaction)
    await expect(
      sdb
        .update(whistleblowerNotes)
        .set({ body: "x" })
        .where(eq(whistleblowerNotes.id, noteRow.id)),
    ).rejects.toThrow();
  });

  it("a value no configured key can decrypt is counted as failed and left untouched", async () => {
    const { db: sdb, client } = scratch;
    const s = await seedCompany(sdb, `rot2-${uid()}`);
    vi.stubEnv(
      "REPORT_ENCRYPTION_KEYS",
      `old:${randomBytes(32).toString("base64")}`,
    );
    const code = await storeReport(sdb, s.company.id, {
      category: "fraud",
      description: "lost key",
      contact: null,
      images: [],
    });
    vi.stubEnv(
      "REPORT_ENCRYPTION_KEYS",
      `new:${randomBytes(32).toString("base64")}`,
    );
    const [before] = await sdb
      .select()
      .from(whistleblowerReports)
      .where(eq(whistleblowerReports.trackingCode, code));
    const r = await rotate(client, { apply: true });
    expect(r.failed).toBe(1);
    expect(r.rewritten).toBe(0);
    const [after] = await sdb
      .select()
      .from(whistleblowerReports)
      .where(eq(whistleblowerReports.trackingCode, code));
    expect(after.description).toBe(before.description);
  });
});

describe("company slug at provisioning", () => {
  it("two companies with the same name get distinct slugs (suffix on collision); a rename never changes it", async () => {
    const name = `Slug Teste ${uid()} Ltda`;
    const slug1 = await uniqueCompanySlug(db, name);
    expect(slug1).toBe(slugify(name));
    const [c1] = await db
      .insert(companies)
      .values({ name, slug: slug1, taxId: "11222333000181", country: "br" })
      .returning();
    const slug2 = await uniqueCompanySlug(db, name);
    expect(slug2).toMatch(new RegExp(`^${slug1}-[a-z0-9]{4}$`));
    await db
      .insert(companies)
      .values({ name, slug: slug2, taxId: "11222333000181", country: "br" });
    // immutable: settings rename leaves the URL alone
    await updateCompanySettings(db, c1.id, {
      name: "Totally Renamed",
      industry: "retail",
    });
    const [after] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, c1.id));
    expect(after.name).toBe("Totally Renamed");
    expect(after.slug).toBe(slug1);
  });

  it("the slug column is unique and not null", async () => {
    const s = await seedCompany(db, `uq-${uid()}`);
    await expect(
      db
        .insert(companies)
        .values({ name: "x", slug: s.company.slug, taxId: "1", country: "br" }),
    ).rejects.toThrow();
  });
});

describe("migration 0004 on a database that already has data", () => {
  it("backfills slugs (same rule as slugify, collisions suffixed), turns 'received' into 'new', then enforces NOT NULL, UNIQUE and the status CHECK", async () => {
    const adminUrl = new URL(process.env.TEST_DATABASE_URL!);
    adminUrl.pathname = "/postgres";
    const admin = await connect(adminUrl.toString());
    const name = `mig_${uid()}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const scratchUrl = new URL(process.env.TEST_DATABASE_URL!);
    scratchUrl.pathname = `/${name}`;
    const c = await connect(scratchUrl.toString());
    try {
      const dir = path.resolve(__dirname, "../lib/db/migrations");
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      const target = files.findIndex((f) => f.startsWith("0004_"));
      expect(target).toBeGreaterThan(0);
      const run = async (file: string) => {
        for (const stmt of readFileSync(path.join(dir, file), "utf8").split(
          "--> statement-breakpoint",
        ))
          if (stmt.trim()) await c.query(stmt);
      };
      for (const f of files.slice(0, target)) await run(f); // the schema as it was before phase 5

      const names = [
        "Construções São João Ltda.",
        "ACME Ltda",
        "Acme Ltda", // same slug as the line above -> second one is suffixed
        "!!!",
        "Ñandú Importações & Exportações Internacionais do Cone Sul S/A",
      ];
      const ids: string[] = [];
      for (const [i, n] of names.entries()) {
        const r = await c.query(
          "INSERT INTO companies (name, tax_id, country, created_at) VALUES ($1, '1', 'br', now() + $2::int * interval '1 second') RETURNING id",
          [n, i],
        );
        ids.push(r.rows[0].id);
      }
      const u = await c.query(
        "INSERT INTO users (company_id, email) VALUES ($1, 'm@example.test') RETURNING id",
        [ids[0]],
      );
      expect(u.rows).toHaveLength(1);
      await c.query(
        "INSERT INTO whistleblower_reports (company_id, tracking_code, category, description) VALUES ($1, 'OLD1', 'fraud', 'd')",
        [ids[0]],
      );
      expect(
        (await c.query("SELECT status FROM whistleblower_reports")).rows[0]
          .status,
      ).toBe("received");

      await run(files[target]);

      const slugs = (await c.query("SELECT id, slug FROM companies")).rows;
      const slugOf = (i: number) =>
        slugs.find((r) => r.id === ids[i]).slug as string;
      expect(slugOf(0)).toBe(slugify(names[0]));
      expect(slugOf(0)).toBe("construcoes-sao-joao-ltda");
      expect(slugOf(1)).toBe("acme-ltda"); // oldest keeps the plain slug
      expect(slugOf(2)).toMatch(/^acme-ltda-[0-9a-f]{4}$/);
      expect(slugOf(3)).toBe("empresa");
      expect(slugOf(4)).toBe(slugify(names[4]));
      expect(slugOf(4).length).toBeLessThanOrEqual(40);
      expect(new Set(slugs.map((r) => r.slug)).size).toBe(names.length);
      const rep = (
        await c.query(
          "SELECT status, status_changed_at, resolved_at FROM whistleblower_reports",
        )
      ).rows[0];
      expect([rep.status, rep.resolved_at]).toEqual(["new", null]);
      expect(rep.status_changed_at).toBeInstanceOf(Date);

      // constraints are live
      await expect(
        c.query(
          "INSERT INTO companies (name, tax_id, country) VALUES ('n', '1', 'br')",
        ),
      ).rejects.toThrow(/slug/);
      await expect(
        c.query(
          "INSERT INTO companies (name, slug, tax_id, country) VALUES ('n', 'acme-ltda', '1', 'br')",
        ),
      ).rejects.toThrow(/unique|duplicate/);
      await expect(
        c.query("UPDATE whistleblower_reports SET status = 'received'"),
      ).rejects.toThrow(/check/);
      // new tables carry company_id, and the case log is append-only
      await c.query(
        "INSERT INTO whistleblower_notes (company_id, report_id, kind, from_status, to_status, author_user_id) SELECT $1, id, 'status_change', 'new', 'closed', $2 FROM whistleblower_reports",
        [ids[0], u.rows[0].id],
      );
      await expect(c.query("DELETE FROM whistleblower_notes")).rejects.toThrow(
        /append-only/,
      );
    } finally {
      await c.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    }
  });
});
