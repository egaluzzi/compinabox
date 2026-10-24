// @vitest-environment node
import { getTableColumns } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import {
  getBillingRecords,
  getCompany,
  listForTenant,
  TENANT_TABLES,
  updateCompanyProfile,
  type TenantTableName,
} from "@/lib/db/tenant";
import { seedCompany, uid, useTestDb } from "./helpers/db";

let db: ReturnType<typeof useTestDb>;
let A: Awaited<ReturnType<typeof seedCompany>>;
let B: Awaited<ReturnType<typeof seedCompany>>;
const ids: Record<"A" | "B", Record<string, string>> = { A: {}, B: {} };

async function seedTenantRows(who: "A" | "B", companyId: string) {
  const label = `${who}-${uid()}`;
  const [employee] = await db
    .insert(schema.employees)
    .values({
      companyId,
      name: `Emp ${label}`,
      email: `e-${label}@example.test`,
    })
    .returning();
  const [document] = await db
    .insert(schema.documents)
    .values({ companyId, type: "code_of_conduct", content: `doc ${label}` })
    .returning();
  await db.insert(schema.acknowledgments).values({
    companyId,
    employeeId: employee.id,
    documentId: document.id,
    ipAddress: "192.0.2.1",
  });
  await db.insert(schema.employeeSessions).values({
    companyId,
    employeeId: employee.id,
    tokenHash: `hash-${label}`,
    expiresAt: new Date(Date.now() + 3600_000),
  });
  await db
    .insert(schema.trainingCompletions)
    .values({ companyId, employeeId: employee.id, moduleId: "m1", score: 90 });
  await db.insert(schema.disclosures).values({
    companyId,
    employeeId: employee.id,
    type: "gift",
    periodYear: 2026,
    content: `d ${label}`,
  });
  const [report] = await db
    .insert(schema.whistleblowerReports)
    .values({
      companyId,
      trackingCode: `T-${label}`,
      category: "fraud",
      description: `secret ${label}`,
    })
    .returning();
  await db.insert(schema.whistleblowerEvidence).values({
    companyId,
    reportId: report.id,
    fileName: `${label}.enc`,
    contentType: "image/png",
    sizeBytes: 10,
  });
  await db.insert(schema.whistleblowerNotes).values({
    companyId,
    reportId: report.id,
    kind: "status_change",
    fromStatus: "new",
    toStatus: "under_review",
    authorUserId: (who === "A" ? A : B).user.id,
  });
  const [vendor] = await db
    .insert(schema.vendors)
    .values({ companyId, name: `Vendor ${label}` })
    .returning();
  await db.insert(schema.vendorResponses).values({
    companyId,
    vendorId: vendor.id,
    respondentName: `enc-${label}`,
    respondentRole: `enc-${label}`,
    ownershipText: `enc-${label}`,
    pepExposure: false,
    priorSanctions: false,
    antibriberyPolicy: true,
  });
  await db.insert(schema.vendorScreenings).values({
    companyId,
    vendorId: vendor.id,
    provider: "test",
    dataset: "default",
    nameScreened: vendor.name,
    status: "no_match",
  });
  await db.insert(schema.binders).values({
    companyId,
    status: "failed",
    errorCode: "interrupted",
    options: { includeChannelStats: false },
  });
  await db.insert(schema.billingRecords).values({
    companyId,
    amountCents: 1000,
    currency: "BRL",
    paidAt: new Date(),
  });
  ids[who] = { employee: employee.id };
}

beforeAll(async () => {
  db = useTestDb();
  A = await seedCompany(db, `A-${uid()}`);
  B = await seedCompany(db, `B-${uid()}`);
  await seedTenantRows("A", A.company.id);
  await seedTenantRows("B", B.company.id);
});

describe("tenant isolation", () => {
  it("every table in the schema with a company_id column is covered by TENANT_TABLES", () => {
    const exempt = new Set(["users"]); // user->company link; queried via the session, not listed
    const withCompany = Object.entries(schema)
      .filter(([, v]) => v instanceof PgTable)
      .filter(([, v]) => "companyId" in getTableColumns(v as PgTable))
      .map(([k]) => k)
      .filter((k) => !exempt.has(k))
      .sort();
    expect(withCompany).toEqual(Object.keys(TENANT_TABLES).sort());
  });

  for (const name of Object.keys(TENANT_TABLES) as TenantTableName[]) {
    it(`${name}: a tenant sees only its own rows`, async () => {
      for (const [who, co, other] of [
        ["A", A.company.id, B.company.id],
        ["B", B.company.id, A.company.id],
      ] as const) {
        const rows = (await listForTenant(db, name, co)) as {
          companyId: string;
        }[];
        expect(
          rows.length,
          `${who} should have its own ${name}`,
        ).toBeGreaterThan(0);
        expect(rows.every((r) => r.companyId === co)).toBe(true);
        expect(rows.some((r) => r.companyId === other)).toBe(false);
      }
    });
  }

  it("a company id that matches nothing returns nothing (no 'all rows' fallthrough)", async () => {
    for (const name of Object.keys(TENANT_TABLES) as TenantTableName[])
      expect(
        await listForTenant(db, name, "00000000-0000-0000-0000-000000000000"),
      ).toEqual([]);
  });

  it("getCompany / getBillingRecords are scoped", async () => {
    expect((await getCompany(db, A.company.id))?.id).toBe(A.company.id);
    expect(
      (await getBillingRecords(db, A.company.id)).every(
        (r) => r.companyId === A.company.id,
      ),
    ).toBe(true);
  });

  it("updateCompanyProfile touches only the given company", async () => {
    const before = await getCompany(db, B.company.id);
    await updateCompanyProfile(db, A.company.id, {
      name: "Renamed A",
      industry: "finance",
    });
    expect((await getCompany(db, A.company.id))?.name).toBe("Renamed A");
    expect(await getCompany(db, B.company.id)).toEqual(before);
  });
});

describe("/api/onboarding cannot write to another company", () => {
  it("writes to the session's company only, even when the form names another company", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/tenant", () => ({
      getTenant: async () => ({ userId: A.user.id, companyId: A.company.id }),
    }));
    const { POST } = await import("@/app/api/onboarding/route");
    const beforeB = await getCompany(db, B.company.id);
    const form = new FormData();
    form.set("companyName", "Hijack Attempt");
    form.set("industry", "retail");
    form.set("companyId", B.company.id); // ignored: never read
    form.set("company_id", B.company.id);
    const res = await POST(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
    expect((await getCompany(db, A.company.id))?.name).toBe("Hijack Attempt");
    expect(await getCompany(db, B.company.id)).toEqual(beforeB);
    vi.doUnmock("@/lib/auth/tenant");
  });

  it("without a session: 401 and nothing written", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/tenant", () => ({ getTenant: async () => null }));
    const { POST } = await import("@/app/api/onboarding/route");
    const form = new FormData();
    form.set("companyName", "Nope");
    form.set("industry", "retail");
    const before = await getCompany(db, B.company.id);
    const res = await POST(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(401);
    expect(await getCompany(db, B.company.id)).toEqual(before);
    vi.doUnmock("@/lib/auth/tenant");
  });
});
