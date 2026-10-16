// Plain constants for the vendor questionnaire (phase 7).

export const VENDOR_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const MAX_VENDOR_NAME = 200;
export const MAX_VENDOR_TAX_ID = 60;
export const MAX_VENDOR_EMAIL = 254;
export const MAX_SHORT = 200; // respondent name / role, contact name
export const MAX_LONG = 4000; // every free-text answer

export const QUESTIONNAIRE_STATUSES = [
  "not_sent",
  "sent",
  "submitted",
] as const;
export type QuestionnaireStatus = (typeof QUESTIONNAIRE_STATUSES)[number];

/** Encrypted vendor_responses columns (AAD field names). */
export const ENCRYPTED_FIELDS = [
  "respondent_name",
  "respondent_role",
  "ownership_text",
  "pep_details",
  "sanctions_details",
] as const;

/** Public paths carry the token / the answers: never cached, never indexed, no referrer. */
export const VENDOR_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
} as const;

export const INVALID_PATH = "/vendor/link-invalid";
export const THANKS_PATH = "/vendor/thanks";
