// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  acknowledgments,
  employees,
  trainingCompletions,
} from "@/lib/db/schema";
import { listDocuments } from "@/lib/documents/store";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents/types";
import { deactivateEmployee } from "@/lib/employee/admin";
import { submitDisclosure } from "@/lib/employee/disclosure";
import {
  computeCompletion,
  getRoster,
  inviteState,
  type Roster,
  type RosterRow,
  type Step,
} from "@/lib/employee/roster";
import { recordPass } from "@/lib/employee/training";
import { companyCompletion } from "@/lib/dashboard/completion";
import { uid, useTestDb } from "./helpers/db";
import { seedInvited, seedPortalCompany } from "./helpers/employee";

const T0 = new Date("2026-06-01T12:00:00Z");
const done: Step = { state: "done", at: T0 };
const pending: Step = { state: "pending" };
const outdated: Step = { state: "outdated", at: T0 };

const currentDocs = DOCUMENT_TYPES.map((type, i) => ({
  id: `d${i}`,
  type,
  version: 1,
}));
function row(
  over: Partial<RosterRow> & {
    docs?: Partial<Record<DocumentType, Step>>;
  } = {},
): RosterRow {
  const { docs, ...rest } = over;
  return {
    id: uid(),
    name: "N",
    email: "n@x.test",
    invitedAt: null,
    inviteExpiresAt: null,
    deactivatedAt: null,
    invite: "not_invited",
    docs: Object.fromEntries(
      DOCUMENT_TYPES.map((t) => [t, docs?.[t] ?? pending]),
    ) as Record<DocumentType, Step>,
    training: pending,
    disclosure: pending,
    ...rest,
  };
}
const roster = (rows: RosterRow[], trainingAvailable = true): Roster => ({
  rows,
  currentDocs,
  trainingAvailable,
  year: 2026,
});
const allDone = () =>
  row({
    docs: Object.fromEntries(DOCUMENT_TYPES.map((t) => [t, done])) as Record<
      DocumentType,
      Step
    >,
    training: done,
    disclosure: done,
  });

describe("company completion (pure math)", () => {
  it("no employees -> null (the Overview keeps '—')", () => {
    expect(computeCompletion(roster([]))).toMatchObject({
      percent: null,
      activeEmployees: 0,
    });
  });

  it("invited-but-not-started employees count as 0 done", () => {
    const c = computeCompletion(roster([row({ invite: "invited" }), row()]));
    expect(c).toMatchObject({
      percent: 0,
      doneSteps: 0,
      totalSteps: 16,
      fullyComplete: 0,
    });
  });

  it("one fully complete of two: 8 of 16 steps = 50%; fully complete 1 of 2", () => {
    const c = computeCompletion(roster([allDone(), row()]));
    expect(c).toMatchObject({
      percent: 50,
      doneSteps: 8,
      totalSteps: 16,
      fullyComplete: 1,
      activeEmployees: 2,
    });
  });

  it("rounds DOWN, never up: 7 of 8 steps is 87, 100 only when truly 100", () => {
    const almost = allDone();
    almost.disclosure = pending;
    expect(computeCompletion(roster([almost])).percent).toBe(87);
    // 2 of 3 employees complete + 1 with 7/8 -> 23/24 = 95.8 -> 95
    expect(
      computeCompletion(roster([allDone(), allDone(), almost])).percent,
    ).toBe(95);
    expect(computeCompletion(roster([allDone(), allDone()])).percent).toBe(100);
    // 1 of 3 steps would be 33.33.. -> 33; here 5 done of 8 = 62.5 -> 62
    const five = row({
      docs: Object.fromEntries(
        DOCUMENT_TYPES.slice(0, 5).map((t) => [t, done]),
      ),
    });
    expect(computeCompletion(roster([five])).percent).toBe(62);
  });

  it("an outdated acknowledgment is not done", () => {
    const r = allDone();
    r.docs["code_of_conduct"] = outdated;
    expect(computeCompletion(roster([r]))).toMatchObject({
      doneSteps: 7,
      totalSteps: 8,
      percent: 87,
      fullyComplete: 0,
    });
  });

  it("deactivated employees are excluded from every number", () => {
    const off = row({ deactivatedAt: T0 });
    expect(computeCompletion(roster([allDone(), off]))).toMatchObject({
      percent: 100,
      activeEmployees: 1,
      fullyComplete: 1,
      totalSteps: 8,
    });
    expect(computeCompletion(roster([off])).percent).toBeNull();
  });

  it("training unavailable for the locale: the step is excluded (7 required steps, not 8)", () => {
    const r = allDone();
    r.training = "unavailable";
    expect(computeCompletion(roster([r], false))).toMatchObject({
      percent: 100,
      totalSteps: 7,
      fullyComplete: 1,
    });
    const half = row({
      training: "unavailable",
      docs: Object.fromEntries(
        DOCUMENT_TYPES.slice(0, 3).map((t) => [t, done]),
      ),
    });
    expect(computeCompletion(roster([half], false))).toMatchObject({
      doneSteps: 3,
      totalSteps: 7,
      percent: 42,
    });
  });

  it("a company with fewer than six documents requires only the ones that exist", () => {
    const rs = { ...roster([allDone()]), currentDocs: currentDocs.slice(0, 2) };
    expect(computeCompletion(rs)).toMatchObject({
      totalSteps: 4,
      doneSteps: 4,
      percent: 100,
    });
  });

  it("invitation state: not invited / invited / expired / started", () => {
    const now = new Date("2026-06-10T00:00:00Z");
    const future = new Date("2026-06-20T00:00:00Z");
    const past = new Date("2026-06-05T00:00:00Z");
    expect(
      inviteState(
        { invitedAt: null, inviteTokenHash: null, inviteExpiresAt: null },
        now,
      ),
    ).toBe("not_invited");
    expect(
      inviteState(
        { invitedAt: now, inviteTokenHash: "h", inviteExpiresAt: future },
        now,
      ),
    ).toBe("invited");
    expect(
      inviteState(
        { invitedAt: now, inviteTokenHash: "h", inviteExpiresAt: past },
        now,
      ),
    ).toBe("expired");
    expect(
      inviteState(
        { invitedAt: now, inviteTokenHash: null, inviteExpiresAt: future },
        now,
      ),
    ).toBe("started");
  });
});

describe("roster model against a real database", () => {
  let db: ReturnType<typeof useTestDb>;
  beforeAll(() => {
    db = useTestDb();
  });

  it("builds every step from the tables: done with timestamps, pending, training, disclosure — and the Overview number", async () => {
    const { company } = await seedPortalCompany(db, `rc-${uid()}`);
    const docs = await listDocuments(db, company.id);
    const a = (await seedInvited(db, company.id, "Ana")).employee;
    const b = (await seedInvited(db, company.id, "Beto")).employee;
    const off = (await seedInvited(db, company.id, "Zé Desativado")).employee;
    for (const d of docs)
      await db
        .insert(acknowledgments)
        .values({ companyId: company.id, employeeId: a.id, documentId: d.id });
    await recordPass(db, { companyId: company.id, employeeId: a.id }, 90);
    await submitDisclosure(
      db,
      { companyId: company.id, employeeId: a.id },
      { hasConflict: false, details: "" },
    );
    await deactivateEmployee(db, company.id, off.id);

    const r = await getRoster(db, company.id, "pt-BR");
    expect(r.rows.map((x) => x.name)).toEqual(["Ana", "Beto"]); // deactivated hidden by default
    const [ra, rb] = r.rows;
    expect(DOCUMENT_TYPES.every((t) => ra.docs[t].state === "done")).toBe(true);
    expect(ra.training).toMatchObject({ state: "done" });
    expect(ra.disclosure).toMatchObject({ state: "done" });
    expect(DOCUMENT_TYPES.every((t) => rb.docs[t].state === "pending")).toBe(
      true,
    );
    const withOff = await getRoster(db, company.id, "pt-BR", {
      includeDeactivated: true,
    });
    expect(withOff.rows).toHaveLength(3);
    expect(computeCompletion(withOff)).toMatchObject({ activeEmployees: 2 }); // deactivated still excluded
    // 8 of 16 -> 50%
    expect(await companyCompletion(db, company.id, "pt-BR")).toMatchObject({
      percent: 50,
      fullyComplete: 1,
      activeEmployees: 2,
    });
    // the same data, a locale without training: 7 required steps each
    expect(await companyCompletion(db, company.id, "es-AR")).toMatchObject({
      totalSteps: 14,
      doneSteps: 7,
      percent: 50,
    });
  });

  it("ignores another company's rows even if ids collide with nothing: a second tenant starts at zero", async () => {
    const x = await seedPortalCompany(db, `rx-${uid()}`);
    const y = await seedPortalCompany(db, `ry-${uid()}`);
    const ex = (await seedInvited(db, x.company.id, "Xavier")).employee;
    await recordPass(db, { companyId: x.company.id, employeeId: ex.id }, 100);
    expect((await getRoster(db, y.company.id, "pt-BR")).rows).toEqual([]);
    const [only] = (await getRoster(db, x.company.id, "pt-BR")).rows;
    expect(only.training).toMatchObject({ state: "done" });
    const stray = await db
      .select()
      .from(trainingCompletions)
      .where(eq(trainingCompletions.companyId, y.company.id));
    expect(stray).toHaveLength(0);
    expect(
      await db
        .select()
        .from(employees)
        .where(eq(employees.companyId, y.company.id)),
    ).toHaveLength(0);
  });
});
