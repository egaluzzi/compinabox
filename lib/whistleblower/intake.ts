import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db/client";
import { whistleblowerEvidence, whistleblowerReports } from "@/lib/db/schema";
import { sniffImage } from "@/lib/uploads";
import {
  AAD_TABLES,
  isCategory,
  MAX_CONTACT,
  MAX_DESCRIPTION,
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_FILES,
  type ReportCategory,
} from "./constants";
import { aadFor, encryptText } from "./crypto";
import { removeEvidenceFiles, writeEvidenceFile } from "./evidence";
import { stripJpeg, stripPng } from "./image-strip";
import { generateTrackingCode } from "./tracking-code";

// The intake core. It sees only the parsed form: nothing about the request that carried it.

export type IntakeError =
  | "category"
  | "description"
  | "contact"
  | "too_many_files"
  | "file_too_large"
  | "file_type"
  | "file_invalid";

export type Submission = {
  category: ReportCategory;
  description: string;
  contact: string | null;
  /** Cleaned, metadata-free image bytes (stripped, still plaintext until stored). */
  images: { bytes: Uint8Array; contentType: "image/png" | "image/jpeg" }[];
};

/** The hidden honeypot field. A filled value means a bot: pretend success, store nothing. */
export const HONEYPOT_FIELD = "website";

export function isHoneypot(form: FormData): boolean {
  const v = form.get(HONEYPOT_FIELD);
  return typeof v === "string" && v.trim() !== "";
}

export async function parseSubmission(
  form: FormData,
): Promise<
  { ok: true; value: Submission } | { ok: false; error: IntakeError }
> {
  const category = form.get("category");
  if (!isCategory(category)) return { ok: false, error: "category" };

  const description = String(form.get("description") ?? "").trim();
  if (description.length < 1 || description.length > MAX_DESCRIPTION)
    return { ok: false, error: "description" };

  let contact: string | null = null;
  if (form.get("wantsContact") === "yes") {
    contact = String(form.get("contact") ?? "").trim();
    if (contact.length < 1 || contact.length > MAX_CONTACT)
      return { ok: false, error: "contact" };
  }

  // An empty file input arrives as a zero-byte File; that means "no evidence".
  const files = form
    .getAll("evidence")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_EVIDENCE_FILES)
    return { ok: false, error: "too_many_files" };
  const images: Submission["images"] = [];
  for (const file of files) {
    if (file.size > MAX_EVIDENCE_BYTES)
      return { ok: false, error: "file_too_large" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    // The client's file name and declared type are never used or stored.
    const kind = sniffImage(bytes);
    if (kind !== "png" && kind !== "jpg")
      return { ok: false, error: "file_type" };
    const clean = kind === "png" ? stripPng(bytes) : stripJpeg(bytes);
    if (!clean) return { ok: false, error: "file_invalid" };
    images.push({
      bytes: clean,
      contentType: kind === "png" ? "image/png" : "image/jpeg",
    });
  }
  return { ok: true, value: { category, description, contact, images } };
}

/**
 * Files first (encrypted), then the rows in one transaction; if the transaction fails the files
 * are removed again, and if a file cannot be written the report is not created. Returns the
 * tracking code (unnormalised form is 12 chars; the caller formats it for display).
 */
export async function storeReport(
  db: Db,
  companyId: string,
  s: Submission,
  newCode: () => string = generateTrackingCode,
): Promise<string> {
  const written: string[] = [];
  const evidence: {
    id: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }[] = [];
  try {
    for (const img of s.images) {
      const id = randomUUID();
      const fileName = await writeEvidenceFile(companyId, id, img.bytes);
      written.push(fileName);
      evidence.push({
        id,
        fileName,
        contentType: img.contentType,
        sizeBytes: img.bytes.length,
      });
    }
    const description = encryptText(
      s.description,
      aadFor(AAD_TABLES.reports, companyId, "description"),
    );
    const reporterContact =
      s.contact === null
        ? null
        : encryptText(
            s.contact,
            aadFor(AAD_TABLES.reports, companyId, "reporter_contact"),
          );

    return await db.transaction(async (tx) => {
      // A collision on the unique tracking code is ignored by the insert (no aborted
      // transaction) and retried with a fresh code a few times.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        const [row] = await tx
          .insert(whistleblowerReports)
          .values({
            companyId,
            trackingCode: code,
            category: s.category,
            description,
            isAnonymous: s.contact === null,
            reporterContact,
          })
          .onConflictDoNothing({ target: whistleblowerReports.trackingCode })
          .returning({ id: whistleblowerReports.id });
        if (!row) continue;
        for (const e of evidence)
          await tx.insert(whistleblowerEvidence).values({
            id: e.id,
            companyId,
            reportId: row.id,
            fileName: e.fileName,
            contentType: e.contentType,
            sizeBytes: e.sizeBytes,
          });
        return code;
      }
      throw new Error("tracking code space exhausted");
    });
  } catch (err) {
    await removeEvidenceFiles(written).catch(() => {});
    throw err;
  }
}
