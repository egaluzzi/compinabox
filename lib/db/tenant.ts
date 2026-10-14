import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import {
  acknowledgments,
  billingRecords,
  companies,
  disclosures,
  documents,
  employees,
  trainingCompletions,
  vendors,
  whistleblowerReports,
} from "./schema";

/**
 * Tenant-scoped data access. EVERY function takes `companyId` from the authenticated session
 * (lib/auth/tenant.ts) — never from a request param — and filters by it.
 * tests/tenant.test.ts iterates TENANT_TABLES; a new tenant table must be added here and seeded there.
 */
export const TENANT_TABLES = {
  employees,
  documents,
  acknowledgments,
  trainingCompletions,
  disclosures,
  whistleblowerReports,
  vendors,
  billingRecords,
} as const;

export type TenantTableName = keyof typeof TENANT_TABLES;

export function listForTenant(
  db: Db,
  name: TenantTableName,
  companyId: string,
) {
  const table = TENANT_TABLES[name];
  return db.select().from(table).where(eq(table.companyId, companyId));
}

export async function getCompany(db: Db, companyId: string) {
  const [row] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId));
  return row ?? null;
}

export async function updateCompanyProfile(
  db: Db,
  companyId: string,
  patch: { name: string; industry: string; logoFile?: string },
) {
  const [row] = await db
    .update(companies)
    .set({
      name: patch.name,
      industry: patch.industry,
      ...(patch.logoFile ? { logoFile: patch.logoFile } : {}),
      onboardingCompletedAt: new Date(),
    })
    .where(eq(companies.id, companyId))
    .returning();
  return row ?? null;
}

export async function getBillingRecords(db: Db, companyId: string) {
  return db
    .select()
    .from(billingRecords)
    .where(and(eq(billingRecords.companyId, companyId)));
}
