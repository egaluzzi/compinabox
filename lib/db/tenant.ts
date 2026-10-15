import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "@/lib/documents/store";
import type { Db } from "./client";
import {
  acknowledgments,
  billingRecords,
  companies,
  disclosures,
  documents,
  employees,
  trainingCompletions,
  users,
  vendors,
  whistleblowerEvidence,
  whistleblowerNotes,
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
  whistleblowerEvidence,
  whistleblowerNotes,
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
  db: DbOrTx,
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
    .where(and(eq(billingRecords.companyId, companyId)))
    .orderBy(desc(billingRecords.paidAt));
}

/**
 * Settings edit: name, industry and (optionally) logo ONLY. Unlike updateCompanyProfile this
 * never touches onboarding_completed_at, and the old logo file stays on disk.
 */
export async function updateCompanySettings(
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
    })
    .where(eq(companies.id, companyId))
    .returning();
  return row ?? null;
}

/** The signed-in admin, looked up within the tenant (id AND company must match). */
export async function getTenantUser(db: Db, companyId: string, userId: string) {
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.companyId, companyId)));
  return row ?? null;
}

/** Statuses that count as an open whistleblower case (lifecycle: new -> under_review -> closed). */
export const OPEN_REPORT_STATUSES = ["new", "under_review"] as const;

export async function countEmployees(db: Db, companyId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(employees)
    .where(eq(employees.companyId, companyId));
  return row?.n ?? 0;
}

export async function countOpenReports(db: Db, companyId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(whistleblowerReports)
    .where(
      and(
        eq(whistleblowerReports.companyId, companyId),
        inArray(whistleblowerReports.status, [...OPEN_REPORT_STATUSES]),
      ),
    );
  return row?.n ?? 0;
}
