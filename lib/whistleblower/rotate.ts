import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClientBase } from "pg";
import { AAD_TABLES } from "./constants.ts";
import {
  aadFor,
  currentKeyId,
  decryptBytes,
  decryptText,
  encryptBytes,
  encryptText,
  keyIdOf,
} from "./crypto.ts";
import { evidenceDir, evidenceField } from "./evidence.ts";

// Re-encrypts every encrypted column and evidence file under the CURRENT (first) key.
// Idempotent: values already under it are skipped. Dry run unless apply=true. Returns COUNTS
// ONLY — nothing here ever prints or returns content. Runs under bare Node (no path aliases):
// see scripts/rotate-report-key.ts.

export type RotateCounts = {
  /** Values found per kind: reports (description + contact), notes, employee disclosures, vendor questionnaire answers, evidence files. */
  seen: {
    reports: number;
    notes: number;
    disclosures: number;
    vendorResponses: number;
    evidence: number;
  };
  /** Values already under the current key. */
  current: number;
  /** Values re-encrypted (or, in a dry run, that would be). */
  rewritten: number;
  /** Values that could not be decrypted with any configured key (left untouched). */
  failed: number;
};

export async function rotate(
  db: ClientBase,
  opts: { apply: boolean },
): Promise<RotateCounts> {
  const now = currentKeyId();
  const counts: RotateCounts = {
    seen: {
      reports: 0,
      notes: 0,
      disclosures: 0,
      vendorResponses: 0,
      evidence: 0,
    },
    current: 0,
    rewritten: 0,
    failed: 0,
  };
  // Returns the replacement ciphertext, or null if it needs no change / cannot be changed.
  const redo = (value: string, aad: string): string | null => {
    if (keyIdOf(value) === now) {
      counts.current++;
      return null;
    }
    try {
      const next = encryptText(decryptText(value, aad), aad);
      counts.rewritten++;
      return next;
    } catch {
      counts.failed++;
      return null;
    }
  };

  await db.query("BEGIN");
  try {
    const reports = await db.query(
      "SELECT id, company_id, description, reporter_contact FROM whistleblower_reports",
    );
    for (const r of reports.rows) {
      counts.seen.reports++;
      const description = redo(
        r.description,
        aadFor(AAD_TABLES.reports, r.company_id, "description"),
      );
      const contact =
        r.reporter_contact === null
          ? null
          : redo(
              r.reporter_contact,
              aadFor(AAD_TABLES.reports, r.company_id, "reporter_contact"),
            );
      if (opts.apply && (description || contact))
        await db.query(
          "UPDATE whistleblower_reports SET description = COALESCE($1, description), reporter_contact = COALESCE($2, reporter_contact) WHERE id = $3 AND company_id = $4",
          [description, contact, r.id, r.company_id],
        );
    }

    // The case log is append-only (DB trigger). Re-encrypting a body changes no content, so the
    // update trigger is switched off for THIS TRANSACTION only: DDL is transactional, so any
    // failure rolls back and the trigger is never left disabled.
    const notes = await db.query(
      "SELECT id, company_id, body FROM whistleblower_notes WHERE body IS NOT NULL",
    );
    const noteUpdates: [string, string, string][] = [];
    for (const n of notes.rows) {
      counts.seen.notes++;
      const body = redo(n.body, aadFor(AAD_TABLES.notes, n.company_id, "body"));
      if (body) noteUpdates.push([body, n.id, n.company_id]);
    }
    if (opts.apply && noteUpdates.length > 0) {
      await db.query(
        "ALTER TABLE whistleblower_notes DISABLE TRIGGER whistleblower_notes_no_update_delete",
      );
      for (const [body, id, companyId] of noteUpdates)
        await db.query(
          "UPDATE whistleblower_notes SET body = $1 WHERE id = $2 AND company_id = $3",
          [body, id, companyId],
        );
      await db.query(
        "ALTER TABLE whistleblower_notes ENABLE TRIGGER whistleblower_notes_no_update_delete",
      );
    }

    // Employee disclosures (phase 6) share the key ring and are append-only too: same sanctioned
    // pattern, trigger off for this transaction only, ciphertext is the only thing that changes.
    const disclosures = await db.query(
      "SELECT id, company_id, content FROM disclosures",
    );
    const disclosureUpdates: [string, string, string][] = [];
    for (const d of disclosures.rows) {
      counts.seen.disclosures++;
      const content = redo(
        d.content,
        aadFor(AAD_TABLES.disclosures, d.company_id, "content"),
      );
      if (content) disclosureUpdates.push([content, d.id, d.company_id]);
    }
    if (opts.apply && disclosureUpdates.length > 0) {
      await db.query(
        "ALTER TABLE disclosures DISABLE TRIGGER disclosures_no_update_delete",
      );
      for (const [content, id, companyId] of disclosureUpdates)
        await db.query(
          "UPDATE disclosures SET content = $1 WHERE id = $2 AND company_id = $3",
          [content, id, companyId],
        );
      await db.query(
        "ALTER TABLE disclosures ENABLE TRIGGER disclosures_no_update_delete",
      );
    }

    // Vendor questionnaire answers (phase 7): append-only too, same sanctioned pattern. Five
    // encrypted columns per row; the booleans are plain and never touched.
    const vendorCols = [
      "respondent_name",
      "respondent_role",
      "ownership_text",
      "pep_details",
      "sanctions_details",
    ] as const;
    const responses = await db.query(
      `SELECT id, company_id, ${vendorCols.join(", ")} FROM vendor_responses`,
    );
    const responseUpdates: {
      id: string;
      companyId: string;
      set: Record<string, string>;
    }[] = [];
    for (const r of responses.rows) {
      counts.seen.vendorResponses++;
      const set: Record<string, string> = {};
      for (const col of vendorCols) {
        if (r[col] === null) continue;
        const next = redo(
          r[col],
          aadFor(AAD_TABLES.vendorResponses, r.company_id, col),
        );
        if (next) set[col] = next;
      }
      if (Object.keys(set).length > 0)
        responseUpdates.push({ id: r.id, companyId: r.company_id, set });
    }
    if (opts.apply && responseUpdates.length > 0) {
      await db.query(
        "ALTER TABLE vendor_responses DISABLE TRIGGER vendor_responses_no_update_delete",
      );
      for (const u of responseUpdates) {
        const cols = Object.keys(u.set); // fixed column names from vendorCols, never user input
        await db.query(
          `UPDATE vendor_responses SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id = $${cols.length + 1} AND company_id = $${cols.length + 2}`,
          [...cols.map((c) => u.set[c]), u.id, u.companyId],
        );
      }
      await db.query(
        "ALTER TABLE vendor_responses ENABLE TRIGGER vendor_responses_no_update_delete",
      );
    }

    const files = await db.query(
      "SELECT id, company_id, file_name FROM whistleblower_evidence",
    );
    for (const f of files.rows) {
      counts.seen.evidence++;
      const file = path.join(evidenceDir(), f.file_name);
      let sealed: string;
      try {
        sealed = await readFile(file, "utf8");
      } catch {
        counts.failed++;
        continue;
      }
      if (keyIdOf(sealed) === now) {
        counts.current++;
        continue;
      }
      try {
        const aad = aadFor(
          AAD_TABLES.evidence,
          f.company_id,
          evidenceField(f.id),
        );
        const next = encryptBytes(decryptBytes(sealed, aad), aad);
        counts.rewritten++;
        if (opts.apply) {
          const tmp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
          await writeFile(tmp, next, { flag: "wx", mode: 0o600 });
          await rename(tmp, file);
        }
      } catch {
        counts.failed++;
      }
    }
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
  return counts;
}
