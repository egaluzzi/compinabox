import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { companies, documents } from "@/lib/db/schema";
import { isCountry } from "@/lib/countries";
import { COUNTRY_LOCALE } from "@/lib/i18n";
import { isIndustry } from "@/lib/industries";
import { DocumentGenerationError } from "./errors";
import { generateDocument, serializeDocument } from "./generate";
import { DOCUMENT_TYPES, type DocumentType } from "./types";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either a plain connection (we open a transaction) or a transaction the caller already holds. */
export type DbOrTx = Db | Tx;

export type DocumentRow = typeof documents.$inferSelect;
export type RegenerateResult = {
  type: DocumentType;
  created: boolean;
  document: DocumentRow;
};

const isTx = (db: DbOrTx): db is Tx => !("$client" in db);

async function inTransaction<T>(
  db: DbOrTx,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return isTx(db) ? fn(db) : db.transaction(fn);
}

/**
 * Generates the next version of `types` for the company from its CURRENT name/industry.
 * - Serialised per company: the company row is locked FOR UPDATE, so concurrent regenerations
 *   cannot compute the same next version (the unique constraint is the backstop).
 * - Unchanged content (compared with the latest version) is a no-op that returns that version.
 * - Throws (and the surrounding transaction rolls back) if generation fails.
 */
export async function regenerateDocuments(
  db: DbOrTx,
  companyId: string,
  opts: { types?: readonly DocumentType[]; userId?: string | null } = {},
): Promise<RegenerateResult[]> {
  const types = opts.types ?? DOCUMENT_TYPES;
  return inTransaction(db, async (tx) => {
    const locked = await tx.execute(
      sql`select id from companies where id = ${companyId} for update`,
    );
    if (locked.rows.length === 0) throw new Error("company not found");
    const [company] = await tx
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));
    if (!isCountry(company.country))
      throw new DocumentGenerationError("not_yet_enabled", "unknown country");
    if (!isIndustry(company.industry))
      throw new Error("company has no industry yet (onboarding incomplete)");
    const locale = COUNTRY_LOCALE[company.country];

    const out: RegenerateResult[] = [];
    for (const type of types) {
      const content = serializeDocument(
        generateDocument({
          type,
          locale,
          country: company.country,
          company: { name: company.name, industry: company.industry },
        }),
      );
      const [latest] = await tx
        .select()
        .from(documents)
        .where(
          and(eq(documents.companyId, companyId), eq(documents.type, type)),
        )
        .orderBy(desc(documents.version))
        .limit(1);
      if (latest && latest.content === content) {
        out.push({ type, created: false, document: latest });
        continue;
      }
      const [row] = await tx
        .insert(documents)
        .values({
          companyId,
          type,
          version: (latest?.version ?? 0) + 1,
          locale,
          templateVersion: JSON.parse(content).templateVersion,
          content,
          generatedByUserId: opts.userId ?? null,
        })
        .returning();
      out.push({ type, created: true, document: row });
    }
    return out;
  });
}

/**
 * Onboarding completion: creates the six documents unless the company already has them all
 * (idempotent). Called in the same transaction as the profile update.
 */
export async function ensureInitialDocuments(
  db: DbOrTx,
  companyId: string,
  userId?: string | null,
) {
  return inTransaction(db, async (tx) => {
    const existing = await tx
      .selectDistinct({ type: documents.type })
      .from(documents)
      .where(eq(documents.companyId, companyId));
    const have = new Set(existing.map((r) => r.type));
    const missing = DOCUMENT_TYPES.filter((t) => !have.has(t));
    if (missing.length === 0) return [];
    return regenerateDocuments(tx, companyId, { types: missing, userId });
  });
}

// --- Tenant-scoped reads: companyId always comes from the session --------------------------

export async function listDocuments(db: Db, companyId: string) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.companyId, companyId))
    .orderBy(documents.type, desc(documents.version));
}

export async function getDocument(db: Db, companyId: string, id: string) {
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.companyId, companyId)));
  return row ?? null;
}
