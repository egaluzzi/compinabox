import { DEFAULT_DATASET } from "./constants.ts";
import { OpenSanctionsProvider } from "./opensanctions.ts";
import type { ScreeningProvider } from "./types.ts";

export type {
  Match,
  ScreeningErrorCode,
  ScreeningInput,
  ScreeningOutcome,
  ScreeningProvider,
} from "./types.ts";

/** Used when no key is configured: visibly unavailable, never a silent fallback or a fake result. */
const unconfigured = (dataset: string): ScreeningProvider => ({
  name: "none",
  available: false,
  dataset,
  screen: async () => ({ status: "error", code: "not_configured" }),
});

/** OpenSanctions when SCREENING_API_KEY is set (and not the placeholder); otherwise unavailable. */
export function getScreeningProvider(
  env: Record<string, string | undefined> = process.env,
): ScreeningProvider {
  const dataset = env.SCREENING_DATASET || DEFAULT_DATASET;
  const key = env.SCREENING_API_KEY;
  if (!key || key === "changeme") return unconfigured(dataset);
  return new OpenSanctionsProvider(
    key,
    env.SCREENING_BASE_URL || undefined,
    dataset,
  );
}
