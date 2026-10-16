import type { ScreeningMatch } from "@/lib/db/schema";

export type Match = ScreeningMatch;

export type ScreeningErrorCode =
  | "timeout"
  | "auth"
  | "rate_limited"
  | "upstream"
  | "bad_response"
  | "not_configured";

export type ScreeningStatus = "no_match" | "possible_match" | "error";

export type ScreeningInput = { name: string; country?: string };

export type ScreeningOutcome =
  | {
      status: "no_match" | "possible_match";
      matches: Match[];
      dataset: string;
    }
  | { status: "error"; code: ScreeningErrorCode };

/**
 * The seam between us and a sanctions/PEP data provider. What leaves the system is exactly
 * `ScreeningInput`: the vendor name and an optional country code, nothing else.
 */
export interface ScreeningProvider {
  readonly name: string;
  /** False when the provider is not configured: the UI shows "screening unavailable". */
  readonly available: boolean;
  /** The dataset the lists come from (shown next to every result). */
  readonly dataset: string;
  screen(input: ScreeningInput): Promise<ScreeningOutcome>;
}
