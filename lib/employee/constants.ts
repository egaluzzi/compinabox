// Plain constants for the employee portal (phase 6).

export const SESSION_COOKIE = "employee_session";
/** The cookie is scoped to /employee so the browser never sends it anywhere else. */
export const SESSION_COOKIE_PATH = "/employee";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** "Send pending invitations" processes at most this many employees per click. */
export const INVITE_BATCH_MAX = 50;

export const DISCLOSURE_TYPE = "conflict_of_interest_annual";
export const MAX_DISCLOSURE_DETAILS = 5000;

export const MAX_CSV_BYTES = 256 * 1024;
export const MAX_CSV_ROWS = 500;
export const MAX_NAME = 120;
export const MAX_EMAIL = 254;
/** Invalid rows are listed up to this many; the rest are only counted. */
export const MAX_REPORTED_INVALID = 20;

/** The current disclosure period: the calendar year in UTC. */
export const disclosureYear = (now = new Date()) => now.getUTCFullYear();
