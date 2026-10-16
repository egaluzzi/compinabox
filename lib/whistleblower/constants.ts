// Plain constants shared by the intake, the dashboard and the key-rotation script.
// No imports on purpose: scripts/rotate-report-key.ts runs this tree under bare Node.

export const REPORT_CATEGORIES = [
  "corruption_bribery",
  "conflict_of_interest",
  "fraud",
  "harassment",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const isCategory = (v: unknown): v is ReportCategory =>
  typeof v === "string" && (REPORT_CATEGORIES as readonly string[]).includes(v);

/** Lifecycle: any transition among the three is allowed from the dashboard (reopening is real life). */
export const REPORT_STATUSES = ["new", "under_review", "closed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const isStatus = (v: unknown): v is ReportStatus =>
  typeof v === "string" && (REPORT_STATUSES as readonly string[]).includes(v);

export const MAX_DESCRIPTION = 10_000;
export const MAX_CONTACT = 254;
export const MAX_NOTE = 10_000;
export const MAX_EVIDENCE_FILES = 3;
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

/** Table names used in the encryption AAD (lib/whistleblower/crypto.ts). */
export const AAD_TABLES = {
  reports: "whistleblower_reports",
  notes: "whistleblower_notes",
  evidence: "whistleblower_evidence",
  /** Employee conflict-of-interest disclosures (phase 6) share the same key ring and rotation. */
  disclosures: "disclosures",
  /** Vendor questionnaire answers (phase 7), same key ring and rotation. */
  vendorResponses: "vendor_responses",
} as const;
