import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { sequentially } from "@/lib/db/sequence";
import {
  acknowledgments,
  disclosures,
  documents,
  employees,
  trainingCompletions,
} from "@/lib/db/schema";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents/types";
import type { Locale } from "@/lib/i18n";
import { MODULE_ID } from "@/lib/training/content";
import { trainingAvailable } from "@/lib/training/grading";
import { DISCLOSURE_TYPE, disclosureYear } from "./constants";

// The roster model (phase 6): ONE tenant-scoped function that says, per employee, where every
// required step stands. The dashboard grid, the CSV, the PDF and (phase 8) the binder all use it,
// so the numbers can never disagree. companyId comes from the session, always.

export type Step =
  | { state: "done"; at: Date }
  /** Accepted an older version of the document: must accept the current one. */
  | { state: "outdated"; at: Date }
  | { state: "pending" };

export type InviteState = "not_invited" | "invited" | "expired" | "started";

export type RosterRow = {
  id: string;
  name: string;
  email: string;
  invitedAt: Date | null;
  inviteExpiresAt: Date | null;
  deactivatedAt: Date | null;
  invite: InviteState;
  docs: Record<DocumentType, Step>;
  /** "unavailable" = no training content for the company's locale (excluded from completion). */
  training: Step | "unavailable";
  disclosure: Step;
};

export type CurrentDocument = {
  id: string;
  type: DocumentType;
  version: number;
};

export type Roster = {
  rows: RosterRow[];
  /** The company's current (latest) version of each document type that exists. */
  currentDocs: CurrentDocument[];
  trainingAvailable: boolean;
  year: number;
};

export function inviteState(
  e: {
    invitedAt: Date | null;
    inviteTokenHash: string | null;
    inviteExpiresAt: Date | null;
  },
  now: Date,
): InviteState {
  if (e.inviteTokenHash) {
    return e.inviteExpiresAt && e.inviteExpiresAt > now ? "invited" : "expired";
  }
  return e.invitedAt ? "started" : "not_invited";
}

export async function getRoster(
  db: Db,
  companyId: string,
  locale: Locale,
  opts: { includeDeactivated?: boolean; now?: Date } = {},
): Promise<Roster> {
  const now = opts.now ?? new Date();
  const year = disclosureYear(now);
  const hasTraining = trainingAvailable(locale);

  // one after another: the phase 8 binder runs this inside a single-connection transaction
  const [emps, docRows, acks, trainings, discs] = await sequentially([
    db
      .select()
      .from(employees)
      .where(
        opts.includeDeactivated
          ? eq(employees.companyId, companyId)
          : and(
              eq(employees.companyId, companyId),
              isNull(employees.deactivatedAt),
            ),
      )
      .orderBy(employees.name, employees.email),
    db
      .select({
        id: documents.id,
        type: documents.type,
        version: documents.version,
      })
      .from(documents)
      .where(eq(documents.companyId, companyId))
      .orderBy(documents.type, desc(documents.version)),
    db
      .select({
        employeeId: acknowledgments.employeeId,
        documentId: acknowledgments.documentId,
        acceptedAt: acknowledgments.acceptedAt,
        type: documents.type,
      })
      .from(acknowledgments)
      .innerJoin(documents, eq(documents.id, acknowledgments.documentId))
      .where(eq(acknowledgments.companyId, companyId)),
    db
      .select({
        employeeId: trainingCompletions.employeeId,
        completedAt: trainingCompletions.completedAt,
      })
      .from(trainingCompletions)
      .where(
        and(
          eq(trainingCompletions.companyId, companyId),
          eq(trainingCompletions.moduleId, MODULE_ID),
        ),
      ),
    db
      .select({
        employeeId: disclosures.employeeId,
        submittedAt: disclosures.submittedAt,
      })
      .from(disclosures)
      .where(
        and(
          eq(disclosures.companyId, companyId),
          eq(disclosures.type, DISCLOSURE_TYPE),
          eq(disclosures.periodYear, year),
        ),
      ),
  ]);

  // Newest version first within a type: the first row per type is the current one.
  const currentDocs: CurrentDocument[] = [];
  for (const type of DOCUMENT_TYPES) {
    const r = docRows.find((d) => d.type === type);
    if (r) currentDocs.push({ id: r.id, type, version: r.version });
  }
  const currentId = new Map(currentDocs.map((d) => [d.type, d.id]));

  const ackBy = new Map<string, typeof acks>();
  for (const a of acks) {
    const list = ackBy.get(a.employeeId);
    if (list) list.push(a);
    else ackBy.set(a.employeeId, [a]);
  }
  const trainBy = new Map(trainings.map((t) => [t.employeeId, t.completedAt]));
  const discBy = new Map(discs.map((d) => [d.employeeId, d.submittedAt]));

  const rows: RosterRow[] = emps.map((e) => {
    const mine = ackBy.get(e.id) ?? [];
    const docs = {} as Record<DocumentType, Step>;
    for (const type of DOCUMENT_TYPES) {
      const cur = currentId.get(type);
      const ofType = mine.filter((a) => a.type === type);
      const exact = cur ? ofType.find((a) => a.documentId === cur) : undefined;
      if (exact) docs[type] = { state: "done", at: exact.acceptedAt };
      else if (ofType.length > 0)
        docs[type] = {
          state: "outdated",
          at: ofType.reduce(
            (m, a) => (a.acceptedAt > m ? a.acceptedAt : m),
            ofType[0].acceptedAt,
          ),
        };
      else docs[type] = { state: "pending" };
    }
    const trained = trainBy.get(e.id);
    const disclosed = discBy.get(e.id);
    return {
      id: e.id,
      name: e.name,
      email: e.email,
      invitedAt: e.invitedAt,
      inviteExpiresAt: e.inviteExpiresAt,
      deactivatedAt: e.deactivatedAt,
      invite: inviteState(e, now),
      docs,
      training: !hasTraining
        ? "unavailable"
        : trained
          ? { state: "done", at: trained }
          : { state: "pending" },
      disclosure: disclosed
        ? { state: "done", at: disclosed }
        : { state: "pending" },
    };
  });

  return { rows, currentDocs, trainingAvailable: hasTraining, year };
}

export type Completion = {
  /** completed required steps / total required steps over ACTIVE employees, rounded DOWN; null with no active employees. */
  percent: number | null;
  doneSteps: number;
  totalSteps: number;
  activeEmployees: number;
  fullyComplete: number;
};

/** Required steps for one employee: each current document + training (if available) + disclosure. */
export function stepsOf(row: RosterRow, roster: Pick<Roster, "currentDocs">) {
  const steps: Step[] = [
    ...roster.currentDocs.map((d) => row.docs[d.type]),
    ...(row.training === "unavailable" ? [] : [row.training]),
    row.disclosure,
  ];
  return steps;
}

/**
 * The company completion number (SUPERVISOR_NOTES): completed required steps ÷ total required
 * steps across active employees, rounded down (never shows 100 unless truly 100). Deactivated
 * employees are excluded; "outdated" and "pending" are not done; zero active employees -> null.
 */
export function computeCompletion(roster: Roster): Completion {
  const active = roster.rows.filter((r) => !r.deactivatedAt);
  let done = 0;
  let total = 0;
  let fully = 0;
  for (const r of active) {
    const steps = stepsOf(r, roster);
    const d = steps.filter((s) => s.state === "done").length;
    done += d;
    total += steps.length;
    if (steps.length > 0 && d === steps.length) fully++;
  }
  return {
    percent:
      active.length === 0 || total === 0
        ? null
        : Math.floor((done * 100) / total),
    doneSteps: done,
    totalSteps: total,
    activeEmployees: active.length,
    fullyComplete: fully,
  };
}

export function isFullyComplete(row: RosterRow, roster: Roster) {
  const steps = stepsOf(row, roster);
  return steps.length > 0 && steps.every((s) => s.state === "done");
}
