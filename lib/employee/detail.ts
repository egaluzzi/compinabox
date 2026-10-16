import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  acknowledgments,
  documents,
  trainingCompletions,
} from "@/lib/db/schema";
import { MODULE_ID } from "@/lib/training/content";
import { getEmployee } from "./admin";
import { listDisclosures } from "./disclosure";

/**
 * One employee's full record for the ADMIN detail page (acknowledgments with IP, training,
 * decrypted disclosures). companyId is the admin's session company; an id from another company
 * returns null.
 */
export async function getEmployeeRecord(
  db: Db,
  companyId: string,
  employeeId: string,
) {
  const employee = await getEmployee(db, companyId, employeeId);
  if (!employee) return null;
  const acks = await db
    .select({
      id: acknowledgments.id,
      acceptedAt: acknowledgments.acceptedAt,
      ipAddress: acknowledgments.ipAddress,
      type: documents.type,
      version: documents.version,
    })
    .from(acknowledgments)
    .innerJoin(
      documents,
      and(
        eq(documents.id, acknowledgments.documentId),
        eq(documents.companyId, acknowledgments.companyId),
      ),
    )
    .where(
      and(
        eq(acknowledgments.companyId, companyId),
        eq(acknowledgments.employeeId, employeeId),
      ),
    )
    .orderBy(desc(acknowledgments.acceptedAt));
  const [training] = await db
    .select()
    .from(trainingCompletions)
    .where(
      and(
        eq(trainingCompletions.companyId, companyId),
        eq(trainingCompletions.employeeId, employeeId),
        eq(trainingCompletions.moduleId, MODULE_ID),
      ),
    );
  const disclosures = await listDisclosures(db, companyId, employeeId);
  return { employee, acks, training: training ?? null, disclosures };
}
