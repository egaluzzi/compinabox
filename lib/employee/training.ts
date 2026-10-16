import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { trainingCompletions } from "@/lib/db/schema";
import { MODULE_ID } from "@/lib/training/content";
import type { PortalEmployee } from "./session";

/** Stores a PASS (failures are never stored). Idempotent: the first pass is the record. */
export async function recordPass(
  db: Db,
  me: Pick<PortalEmployee, "companyId" | "employeeId">,
  score: number,
): Promise<boolean> {
  const rows = await db
    .insert(trainingCompletions)
    .values({
      companyId: me.companyId,
      employeeId: me.employeeId,
      moduleId: MODULE_ID,
      score,
    })
    .onConflictDoNothing({
      target: [trainingCompletions.employeeId, trainingCompletions.moduleId],
    })
    .returning({ id: trainingCompletions.id });
  return rows.length > 0;
}

export async function getCompletion(
  db: Db,
  me: Pick<PortalEmployee, "companyId" | "employeeId">,
) {
  const [row] = await db
    .select()
    .from(trainingCompletions)
    .where(
      and(
        eq(trainingCompletions.companyId, me.companyId),
        eq(trainingCompletions.employeeId, me.employeeId),
        eq(trainingCompletions.moduleId, MODULE_ID),
      ),
    );
  return row ?? null;
}

/** All passes of the company (tenant-scoped), keyed by employee id. */
export async function getTrainingResults(db: Db, companyId: string) {
  const rows = await db
    .select()
    .from(trainingCompletions)
    .where(
      and(
        eq(trainingCompletions.companyId, companyId),
        eq(trainingCompletions.moduleId, MODULE_ID),
      ),
    );
  return new Map(rows.map((r) => [r.employeeId, r]));
}
