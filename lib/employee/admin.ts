import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { employees, employeeSessions } from "@/lib/db/schema";
import type { ParsedRoster } from "./csv";

// Dashboard-side roster operations. `companyId` is always the admin's session company.

export type ImportSummary = {
  created: number;
  reactivated: number;
  skipped: number;
  invalid: number;
};

/**
 * Applies a parsed CSV: new emails are created, an existing ACTIVE email is skipped, an existing
 * DEACTIVATED email is reactivated (left un-invited until the admin sends an invitation).
 * Valid rows are imported even when others were invalid.
 */
export async function importEmployees(
  db: Db,
  companyId: string,
  parsed: ParsedRoster,
): Promise<ImportSummary> {
  const out: ImportSummary = {
    created: 0,
    reactivated: 0,
    skipped: parsed.duplicatesInFile,
    invalid: parsed.invalidCount,
  };
  if (parsed.valid.length === 0) return out;
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: employees.id,
        email: employees.email,
        off: employees.deactivatedAt,
      })
      .from(employees)
      .where(
        and(
          eq(employees.companyId, companyId),
          inArray(
            employees.email,
            parsed.valid.map((r) => r.email),
          ),
        ),
      );
    const byEmail = new Map(existing.map((e) => [e.email, e]));
    for (const row of parsed.valid) {
      const e = byEmail.get(row.email);
      if (!e) {
        const ins = await tx
          .insert(employees)
          .values({ companyId, name: row.name, email: row.email })
          .onConflictDoNothing({
            target: [employees.companyId, employees.email],
          })
          .returning({ id: employees.id });
        if (ins.length > 0) out.created++;
        else out.skipped++;
      } else if (e.off) {
        await tx
          .update(employees)
          .set({
            deactivatedAt: null,
            invitedAt: null,
            inviteExpiresAt: null,
            inviteTokenHash: null,
          })
          .where(
            and(eq(employees.id, e.id), eq(employees.companyId, companyId)),
          );
        out.reactivated++;
      } else out.skipped++;
    }
  });
  return out;
}

export async function getEmployee(db: Db, companyId: string, id: string) {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.companyId, companyId)));
  return row ?? null;
}

/**
 * Deactivate: never a delete. Kills the employee's sessions and the unused invite link; their
 * records stay but they leave the grid default view and every completion number.
 */
export async function deactivateEmployee(
  db: Db,
  companyId: string,
  id: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(employees)
      .set({ deactivatedAt: new Date(), inviteTokenHash: null })
      .where(and(eq(employees.id, id), eq(employees.companyId, companyId)))
      .returning({ id: employees.id });
    if (rows.length === 0) return false;
    await tx
      .delete(employeeSessions)
      .where(
        and(
          eq(employeeSessions.employeeId, id),
          eq(employeeSessions.companyId, companyId),
        ),
      );
    return true;
  });
}

/** Reactivate: back in the roster, un-invited until the admin sends an invitation. Idempotent. */
export async function reactivateEmployee(
  db: Db,
  companyId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .update(employees)
    .set({
      deactivatedAt: null,
      invitedAt: null,
      inviteExpiresAt: null,
      inviteTokenHash: null,
    })
    .where(
      and(
        eq(employees.id, id),
        eq(employees.companyId, companyId),
        isNotNull(employees.deactivatedAt),
      ),
    )
    .returning({ id: employees.id });
  if (rows.length > 0) return true;
  // Already active (double click): fine, as long as the employee exists in this company.
  return (await getEmployee(db, companyId, id)) !== null;
}
