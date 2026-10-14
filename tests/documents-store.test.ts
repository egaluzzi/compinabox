// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { companies, documents } from "@/lib/db/schema";
import { getDocument, listDocuments } from "@/lib/documents/store";
import {
  ensureInitialDocuments,
  regenerateDocuments,
} from "@/lib/documents/store";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { seedCompany, uid, useTestDb } from "./helpers/db";

let db: ReturnType<typeof useTestDb>;
beforeAll(() => {
  db = useTestDb();
});

async function onboarded(name = `Docs Co ${uid()}`, industry = "technology") {
  const seeded = await seedCompany(db);
  await db
    .update(companies)
    .set({ name, industry, onboardingCompletedAt: new Date() })
    .where(eq(companies.id, seeded.company.id));
  return seeded;
}
/** Drizzle wraps driver errors; the Postgres message is on `cause`. */
async function expectPgError(p: Promise<unknown>, re: RegExp) {
  try {
    await p;
  } catch (e) {
    const err = e as { cause?: { message?: string }; message: string };
    expect(err.cause?.message ?? err.message).toMatch(re);
    return;
  }
  expect.unreachable("expected the query to fail");
}
const rows = (companyId: string) => listDocuments(db, companyId);

describe("initial documents", () => {
  it("creates the six documents as version 1, once (idempotent)", async () => {
    const { company, user } = await onboarded();
    const first = await ensureInitialDocuments(db, company.id, user.id);
    expect(first.map((r) => r.type).sort()).toEqual([...DOCUMENT_TYPES].sort());
    const all = await rows(company.id);
    expect(all).toHaveLength(6);
    expect(all.every((r) => r.version === 1 && r.locale === "pt-BR")).toBe(
      true,
    );
    expect(all.every((r) => r.generatedByUserId === user.id)).toBe(true);
    expect(all.every((r) => r.templateVersion === 1)).toBe(true);

    expect(await ensureInitialDocuments(db, company.id, user.id)).toEqual([]);
    expect(await rows(company.id)).toHaveLength(6);
  });

  it("concurrent onboarding completions still produce exactly six", async () => {
    const { company } = await onboarded();
    await Promise.all(
      Array.from({ length: 5 }, () => ensureInitialDocuments(db, company.id)),
    );
    expect(await rows(company.id)).toHaveLength(6);
  });

  it("generation failure throws and leaves nothing behind (company in an unsupported country)", async () => {
    const { company } = await onboarded();
    await db
      .update(companies)
      .set({ country: "ar" })
      .where(eq(companies.id, company.id));
    await expect(ensureInitialDocuments(db, company.id)).rejects.toThrow(
      /not enabled yet/,
    );
    expect(await rows(company.id)).toHaveLength(0);
  });

  it("a company without an industry cannot be generated for", async () => {
    const { company } = await seedCompany(db);
    await expect(ensureInitialDocuments(db, company.id)).rejects.toThrow(
      /no industry/,
    );
  });
});

describe("versioning", () => {
  it("unchanged inputs: regenerate is a no-op that returns the current version", async () => {
    const { company } = await onboarded();
    await ensureInitialDocuments(db, company.id);
    const res = await regenerateDocuments(db, company.id);
    expect(res.every((r) => !r.created && r.document.version === 1)).toBe(true);
    expect(await rows(company.id)).toHaveLength(6);
  });

  it("changed company name: new version 2 for every type, version 1 intact", async () => {
    const { company } = await onboarded("Antes Ltda");
    await ensureInitialDocuments(db, company.id);
    const v1 = await rows(company.id);
    await db
      .update(companies)
      .set({ name: "Depois Ltda" })
      .where(eq(companies.id, company.id));
    const res = await regenerateDocuments(db, company.id);
    expect(res.every((r) => r.created && r.document.version === 2)).toBe(true);
    const all = await rows(company.id);
    expect(all).toHaveLength(12);
    for (const old of v1) {
      const still = all.find((r) => r.id === old.id)!;
      expect(still).toEqual(old); // byte-for-byte the same row
      expect(still.content).toContain("Antes Ltda");
      expect(still.content).not.toContain("Depois Ltda");
    }
    expect(
      all
        .filter((r) => r.version === 2)
        .every((r) => r.content.includes("Depois Ltda")),
    ).toBe(true);
  });

  it("regenerating one type leaves the others alone", async () => {
    const { company } = await onboarded("Um Ltda");
    await ensureInitialDocuments(db, company.id);
    await db
      .update(companies)
      .set({ industry: "health" })
      .where(eq(companies.id, company.id));
    const res = await regenerateDocuments(db, company.id, {
      types: ["code_of_conduct"],
    });
    expect(res).toHaveLength(1);
    expect(await rows(company.id)).toHaveLength(7);
  });

  it("concurrent regenerations never produce duplicate versions", async () => {
    const { company } = await onboarded("Corrida Ltda");
    await ensureInitialDocuments(db, company.id);
    await db
      .update(companies)
      .set({ name: "Corrida 2 Ltda" })
      .where(eq(companies.id, company.id));
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => regenerateDocuments(db, company.id)),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const all = await rows(company.id);
    const keys = all.map((r) => `${r.type}:${r.version}`);
    expect(new Set(keys).size).toBe(keys.length);
    // exactly one of the eight created v2; the other seven saw unchanged content
    expect(all).toHaveLength(12);
    expect(Math.max(...all.map((r) => r.version))).toBe(2);
  });

  it("concurrent regenerations interleaved with real changes keep versions unique and consecutive", async () => {
    const { company } = await onboarded("Seq Ltda");
    await ensureInitialDocuments(db, company.id);
    const names = ["Seq A", "Seq B", "Seq C", "Seq D"];
    await Promise.all(
      names.map(async (n) => {
        await db
          .update(companies)
          .set({ name: n })
          .where(eq(companies.id, company.id));
        await regenerateDocuments(db, company.id, {
          types: ["code_of_conduct"],
        });
      }),
    );
    const coc = (await rows(company.id)).filter(
      (r) => r.type === "code_of_conduct",
    );
    const versions = coc.map((r) => r.version).sort((a, b) => a - b);
    expect(versions).toEqual(
      Array.from({ length: versions.length }, (_, i) => i + 1),
    );
  });

  it("snapshots the legal references inside the stored content", async () => {
    const { company } = await onboarded();
    await ensureInitialDocuments(db, company.id);
    const [row] = await rows(company.id);
    const parsed = JSON.parse(row.content);
    expect(
      parsed.legalReferences.map((l: { citation: string }) => l.citation),
    ).toEqual(["Lei 12.846/2013", "Lei 14.133/2021"]);
    expect(parsed.reviewStatus).toBe("draft");
  });
});

describe("append-only in the database", () => {
  async function oneDoc() {
    const { company } = await onboarded();
    await ensureInitialDocuments(db, company.id);
    return (await rows(company.id))[0];
  }
  it("INSERT works", async () => {
    const d = await oneDoc();
    await db.insert(documents).values({
      companyId: d.companyId,
      type: d.type,
      version: d.version + 1,
      content: "{}",
    });
  });
  it("UPDATE is rejected", async () => {
    const d = await oneDoc();
    await expectPgError(
      db
        .update(documents)
        .set({ content: "tampered" })
        .where(eq(documents.id, d.id)),
      /append-only/,
    );
    expect((await getDocument(db, d.companyId, d.id))!.content).toBe(d.content);
  });
  it("DELETE is rejected", async () => {
    const d = await oneDoc();
    await expectPgError(
      db.delete(documents).where(eq(documents.id, d.id)),
      /append-only/,
    );
    expect(await getDocument(db, d.companyId, d.id)).not.toBeNull();
  });
  it("TRUNCATE is rejected", async () => {
    await oneDoc();
    await expectPgError(
      db.execute(sql`truncate table documents, acknowledgments`),
      /append-only/,
    );
  });
  it("unique (company_id, type, version): a duplicate version is rejected", async () => {
    const d = await oneDoc();
    await expectPgError(
      db.insert(documents).values({
        companyId: d.companyId,
        type: d.type,
        version: d.version,
        content: "{}",
      }),
      /documents_company_type_version|duplicate key/,
    );
  });
});

describe("tenant isolation", () => {
  it("another company's document id is invisible: getDocument -> null, list excludes it", async () => {
    const a = await onboarded("Alfa Ltda");
    const b = await onboarded("Beta Ltda");
    await ensureInitialDocuments(db, a.company.id);
    await ensureInitialDocuments(db, b.company.id);
    const aDoc = (await rows(a.company.id))[0];
    expect(await getDocument(db, b.company.id, aDoc.id)).toBeNull();
    expect(await getDocument(db, a.company.id, aDoc.id)).not.toBeNull();
    expect((await rows(b.company.id)).some((r) => r.id === aDoc.id)).toBe(
      false,
    );
    expect(
      (await rows(b.company.id)).every((r) => r.companyId === b.company.id),
    ).toBe(true);
  });
  it("regenerating for company B never writes to company A", async () => {
    const a = await onboarded("Alfa 2 Ltda");
    const b = await onboarded("Beta 2 Ltda");
    await ensureInitialDocuments(db, a.company.id);
    await ensureInitialDocuments(db, b.company.id);
    await db
      .update(companies)
      .set({ name: "Beta 2 Renomeada" })
      .where(eq(companies.id, b.company.id));
    await regenerateDocuments(db, b.company.id);
    expect(await rows(a.company.id)).toHaveLength(6);
    expect(await rows(b.company.id)).toHaveLength(12);
  });
});
