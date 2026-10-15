import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  users,
  whistleblowerEvidence,
  whistleblowerNotes,
  whistleblowerReports,
} from "@/lib/db/schema";
import { aadFor, decryptText, encryptText } from "./crypto";
import { AAD_TABLES, MAX_NOTE, type ReportStatus } from "./constants";

// Every function takes the tenant's `companyId` from the authenticated session (never from a
// request parameter) and filters by it; a report/evidence id from a URL is only a lookup key
// combined with that company_id. Another tenant's id is indistinguishable from a missing one.

const REPORTS = AAD_TABLES.reports;
const NOTES = AAD_TABLES.notes;

export type Actor = { companyId: string; userId: string };

/** Never selects description/contact: the list shows no content (shoulder-surfing, decrypt cost). */
export async function listReports(db: Db, companyId: string, limit = 100) {
  return db
    .select({
      id: whistleblowerReports.id,
      category: whistleblowerReports.category,
      status: whistleblowerReports.status,
      createdAt: whistleblowerReports.createdAt,
    })
    .from(whistleblowerReports)
    .where(eq(whistleblowerReports.companyId, companyId))
    .orderBy(desc(whistleblowerReports.createdAt))
    .limit(limit);
}

/** Decrypts one value; a missing key or a tampered value gives null, it never throws. */
function open(value: string, aad: string): string | null {
  try {
    return decryptText(value, aad);
  } catch {
    return null;
  }
}

export async function getReport(db: Db, companyId: string, id: string) {
  const [row] = await db
    .select()
    .from(whistleblowerReports)
    .where(
      and(
        eq(whistleblowerReports.companyId, companyId),
        eq(whistleblowerReports.id, id),
      ),
    );
  if (!row) return null;
  return {
    id: row.id,
    category: row.category,
    status: row.status,
    isAnonymous: row.isAnonymous,
    createdAt: row.createdAt,
    statusChangedAt: row.statusChangedAt,
    resolvedAt: row.resolvedAt,
    /** null = could not be decrypted (key missing or value tampered): the page says so. */
    description: open(
      row.description,
      aadFor(REPORTS, companyId, "description"),
    ),
    /** null with hasContact = could not be decrypted. */
    hasContact: row.reporterContact !== null,
    contact: row.reporterContact
      ? open(
          row.reporterContact,
          aadFor(REPORTS, companyId, "reporter_contact"),
        )
      : null,
  };
}

export async function listEvidence(
  db: Db,
  companyId: string,
  reportId: string,
) {
  return db
    .select({
      id: whistleblowerEvidence.id,
      contentType: whistleblowerEvidence.contentType,
      sizeBytes: whistleblowerEvidence.sizeBytes,
      createdAt: whistleblowerEvidence.createdAt,
    })
    .from(whistleblowerEvidence)
    .where(
      and(
        eq(whistleblowerEvidence.companyId, companyId),
        eq(whistleblowerEvidence.reportId, reportId),
      ),
    )
    .orderBy(
      asc(whistleblowerEvidence.createdAt),
      asc(whistleblowerEvidence.id),
    );
}

export async function getEvidence(
  db: Db,
  companyId: string,
  reportId: string,
  evidenceId: string,
) {
  const [row] = await db
    .select()
    .from(whistleblowerEvidence)
    .where(
      and(
        eq(whistleblowerEvidence.companyId, companyId),
        eq(whistleblowerEvidence.reportId, reportId),
        eq(whistleblowerEvidence.id, evidenceId),
      ),
    );
  return row ?? null;
}

/** Notes + status changes, oldest first. */
export async function listTimeline(
  db: Db,
  companyId: string,
  reportId: string,
) {
  const rows = await db
    .select({
      id: whistleblowerNotes.id,
      kind: whistleblowerNotes.kind,
      body: whistleblowerNotes.body,
      fromStatus: whistleblowerNotes.fromStatus,
      toStatus: whistleblowerNotes.toStatus,
      createdAt: whistleblowerNotes.createdAt,
      authorEmail: users.email,
    })
    .from(whistleblowerNotes)
    .leftJoin(
      users,
      and(
        eq(users.id, whistleblowerNotes.authorUserId),
        eq(users.companyId, companyId),
      ),
    )
    .where(
      and(
        eq(whistleblowerNotes.companyId, companyId),
        eq(whistleblowerNotes.reportId, reportId),
      ),
    )
    .orderBy(asc(whistleblowerNotes.createdAt), asc(whistleblowerNotes.id));
  return rows.map((r) => ({
    ...r,
    body: r.body ? open(r.body, aadFor(NOTES, companyId, "body")) : null,
  }));
}

/**
 * Moves a report to `to`. The report update carries AND company_id = <session>, and the
 * status_change log row is inserted in the same transaction (the audit trail).
 * Returns null for an unknown/foreign report, "unchanged" if it is already in that status.
 */
export async function changeStatus(
  db: Db,
  actor: Actor,
  reportId: string,
  to: ReportStatus,
): Promise<{ from: string; to: ReportStatus } | "unchanged" | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: whistleblowerReports.status })
      .from(whistleblowerReports)
      .where(
        and(
          eq(whistleblowerReports.companyId, actor.companyId),
          eq(whistleblowerReports.id, reportId),
        ),
      )
      .for("update");
    if (!current) return null;
    if (current.status === to) return "unchanged";
    const now = new Date();
    const updated = await tx
      .update(whistleblowerReports)
      .set({
        status: to,
        statusChangedAt: now,
        resolvedAt: to === "closed" ? now : null,
      })
      .where(
        and(
          eq(whistleblowerReports.id, reportId),
          eq(whistleblowerReports.companyId, actor.companyId),
        ),
      )
      .returning({ id: whistleblowerReports.id });
    if (updated.length === 0) return null;
    await tx.insert(whistleblowerNotes).values({
      companyId: actor.companyId,
      reportId,
      kind: "status_change",
      fromStatus: current.status,
      toStatus: to,
      authorUserId: actor.userId,
      createdAt: now,
    });
    return { from: current.status, to };
  });
}

/** Appends an encrypted note. false = unknown/foreign report or invalid body. */
export async function addNote(
  db: Db,
  actor: Actor,
  reportId: string,
  body: string,
): Promise<boolean> {
  const text = body.trim();
  if (text.length === 0 || text.length > MAX_NOTE) return false;
  const [report] = await db
    .select({ id: whistleblowerReports.id })
    .from(whistleblowerReports)
    .where(
      and(
        eq(whistleblowerReports.companyId, actor.companyId),
        eq(whistleblowerReports.id, reportId),
      ),
    );
  if (!report) return false;
  await db.insert(whistleblowerNotes).values({
    companyId: actor.companyId,
    reportId,
    kind: "note",
    body: encryptText(text, aadFor(NOTES, actor.companyId, "body")),
    authorUserId: actor.userId,
  });
  return true;
}
