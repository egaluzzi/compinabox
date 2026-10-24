// Screening limits live in one place (phase 7). Every run costs money: an explicit admin click,
// a per-vendor cooldown and a per-company daily cap bound the spend.

export const SCREEN_COOLDOWN_MS = 5 * 60 * 1000;
/** Screenings per company per UTC day, errors included (they may be billed). */
export const SCREEN_DAILY_CAP = 50;
export const SCREEN_TIMEOUT_MS = 10_000;
/** Matches kept per run. */
export const MAX_MATCHES = 10;
/** A result with this score or more is a possible match even when the provider did not flag it. */
export const POSSIBLE_MATCH_SCORE = 0.7;
export const DEFAULT_BASE_URL = "https://api.opensanctions.org";
export const DEFAULT_DATASET = "default";
