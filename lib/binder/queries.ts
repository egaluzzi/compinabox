import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { binders } from "@/lib/db/schema";

// Tenant-scoped binder access. EVERY function takes `companyId` from the session (requireTenant)
// and filters by it; a binder id from the URL is only a lookup key combined with it, so another
// company's binder is indistinguishable from a missing one. The PDF bytes are selected ONLY by
// getBinderFile: lists and status polls never load them.

// everything except `pdf`
export const binderMetaColumns = {
  id: binders.id,
  status: binders.status,
  options: binders.options,
  asOf: binders.asOf,
  createdAt: binders.createdAt,
  startedAt: binders.startedAt,
  finishedAt: binders.finishedAt,
  errorCode: binders.errorCode,
  sizeBytes: binders.sizeBytes,
  pageCount: binders.pageCount,
  sha256: binders.sha256,
};
export type BinderMeta = {
  [K in keyof typeof binderMetaColumns]: (typeof binders.$inferSelect)[K];
};

export async function listBinders(db: Db, companyId: string, limit = 50) {
  return db
    .select(binderMetaColumns)
    .from(binders)
    .where(eq(binders.companyId, companyId))
    .orderBy(desc(binders.createdAt))
    .limit(limit);
}

export async function getBinderMeta(db: Db, companyId: string, id: string) {
  const [row] = await db
    .select(binderMetaColumns)
    .from(binders)
    .where(and(eq(binders.id, id), eq(binders.companyId, companyId)));
  return row ?? null;
}

export async function getActiveBinder(db: Db, companyId: string) {
  const [row] = await db
    .select(binderMetaColumns)
    .from(binders)
    .where(
      and(
        eq(binders.companyId, companyId),
        inArray(binders.status, ["queued", "running"]),
      ),
    );
  return row ?? null;
}

/** The ready file, or null if it does not exist, is not ready, or belongs to another company. */
export async function getBinderFile(db: Db, companyId: string, id: string) {
  const [row] = await db
    .select({
      pdf: binders.pdf,
      sha256: binders.sha256,
      asOf: binders.asOf,
    })
    .from(binders)
    .where(
      and(
        eq(binders.id, id),
        eq(binders.companyId, companyId),
        eq(binders.status, "ready"),
      ),
    );
  return row?.pdf && row.asOf ? { ...row, pdf: row.pdf, asOf: row.asOf } : null;
}

/** "dossie-<slug>-YYYYMMDD.pdf": ASCII only (the slug already is), date in the company's zone. */
export function binderFilename(slug: string, asOf: Date) {
  const ymd = asOf
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    .replaceAll("-", "");
  return `dossie-${slug.replace(/[^a-z0-9-]/gi, "")}-${ymd}.pdf`;
}
