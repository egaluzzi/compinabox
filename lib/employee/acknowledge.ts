import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { acknowledgments, documents } from "@/lib/db/schema";
import type { PortalEmployee } from "./session";

export type PortalDocument = {
  row: typeof documents.$inferSelect;
  /** false = a newer version of this type exists (the employee must accept that one). */
  current: boolean;
};

/**
 * A document for the portal: it must belong to the employee's company (from the session), else
 * null (indistinguishable from "does not exist"). `current` says whether it is the latest version.
 */
export async function getPortalDocument(
  db: Db,
  me: Pick<PortalEmployee, "companyId">,
  documentId: string,
): Promise<PortalDocument | null> {
  const [row] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.companyId, me.companyId)),
    );
  if (!row) return null;
  const [latest] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(eq(documents.companyId, me.companyId), eq(documents.type, row.type)),
    )
    .orderBy(desc(documents.version))
    .limit(1);
  return { row, current: latest?.id === row.id };
}

export type AckResult = "accepted" | "already" | "not_found" | "outdated";

/**
 * Records the acceptance. Employee and company come from the session; the document id from the
 * form is only a lookup key combined with the company. Idempotent (double-click safe): the
 * UNIQUE (employee_id, document_id) plus ON CONFLICT DO NOTHING. `ip` is the one client IP the
 * app stores (lib/employee/client-ip.ts) — it goes to this table and nowhere else.
 */
export async function acknowledge(
  db: Db,
  me: Pick<PortalEmployee, "companyId" | "employeeId">,
  documentId: string,
  ip: string | null,
): Promise<AckResult> {
  const doc = await getPortalDocument(db, me, documentId);
  if (!doc) return "not_found";
  if (!doc.current) return "outdated";
  const inserted = await db
    .insert(acknowledgments)
    .values({
      companyId: me.companyId,
      employeeId: me.employeeId,
      documentId: doc.row.id,
      ipAddress: ip,
    })
    .onConflictDoNothing({
      target: [acknowledgments.employeeId, acknowledgments.documentId],
    })
    .returning({ id: acknowledgments.id });
  return inserted.length > 0 ? "accepted" : "already";
}
