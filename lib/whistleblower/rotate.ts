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
  /** Values found per kind: reports (description + contact), notes, evidence files. */
  seen: { reports: number; notes: number; evidence: number };
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
    seen: { reports: 0, notes: 0, evidence: 0 },
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
