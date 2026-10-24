import {
  DEFAULT_BASE_URL,
  DEFAULT_DATASET,
  MAX_MATCHES,
  POSSIBLE_MATCH_SCORE,
  SCREEN_TIMEOUT_MS,
} from "./constants.ts";
import type {
  Match,
  ScreeningErrorCode,
  ScreeningInput,
  ScreeningOutcome,
  ScreeningProvider,
} from "./types.ts";

// OpenSanctions (yente) `/match` client. Nothing here logs, and nothing leaves this file that
// could carry the API key or a response body: errors are fixed short codes.
//
// ASSUMED SHAPE — verify at live check (scripts/screening-live-check.sh):
//   request   POST {base}/match/{dataset}   Authorization: ApiKey <key>
//             {"queries":{"q1":{"schema":"Company","properties":{"name":[..],"country":[..]}}}}
//   response  {"responses":{"q1":{"results":[{"id","caption","schema","score","match",
//             "datasets":[..],"properties":{"topics":[..]}}],"total":{..}}}}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** https only, except loopback (the local smoke stub): a typo'd http:// must not leak the key. */
export function checkedBaseUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("SCREENING_BASE_URL is not a valid URL");
  }
  if (
    u.protocol !== "https:" &&
    !(u.protocol === "http:" && LOOPBACK.has(u.hostname))
  )
    throw new Error(
      "SCREENING_BASE_URL must be https (http is allowed only for localhost)",
    );
  return u.origin + u.pathname.replace(/\/+$/, "");
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function mapResult(r: unknown): { match: Match; flagged: boolean } | null {
  if (!isRecord(r) || typeof r.id !== "string") return null;
  const props = isRecord(r.properties) ? r.properties : {};
  const score =
    typeof r.score === "number" && Number.isFinite(r.score) ? r.score : 0;
  return {
    flagged: r.match === true,
    match: {
      id: r.id,
      caption: typeof r.caption === "string" ? r.caption : r.id,
      score,
      datasets: strings(r.datasets),
      topics: strings(props.topics ?? r.topics),
    },
  };
}

/** Pure mapping of a parsed 2xx body; exported for the tests. null = not the expected shape. */
export function mapResponse(body: unknown, dataset: string): ScreeningOutcome {
  const q1 =
    isRecord(body) && isRecord(body.responses) ? body.responses.q1 : undefined;
  if (!isRecord(q1) || !Array.isArray(q1.results))
    return { status: "error", code: "bad_response" };
  const mapped = q1.results.map(mapResult);
  if (mapped.some((m) => m === null))
    return { status: "error", code: "bad_response" };
  const rows = (mapped as { match: Match; flagged: boolean }[]).sort(
    (a, b) => b.match.score - a.match.score,
  );
  const possible = rows.some(
    (m) => m.flagged || m.match.score >= POSSIBLE_MATCH_SCORE,
  );
  return {
    status: possible ? "possible_match" : "no_match",
    matches: rows.slice(0, MAX_MATCHES).map((m) => m.match),
    dataset,
  };
}

const statusCode = (s: number): ScreeningErrorCode =>
  s === 401 || s === 403 ? "auth" : s === 429 ? "rate_limited" : "upstream";

export class OpenSanctionsProvider implements ScreeningProvider {
  readonly name = "opensanctions";
  readonly available = true;
  readonly dataset: string;
  // Plain fields, not constructor parameter properties: scripts/screening-live-check.sh runs this
  // file under Node's strip-only TypeScript mode.
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  constructor(
    apiKey: string,
    baseUrl: string = DEFAULT_BASE_URL,
    dataset: string = DEFAULT_DATASET,
    timeoutMs: number = SCREEN_TIMEOUT_MS,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.dataset = dataset;
    this.timeoutMs = timeoutMs;
  }

  async screen(input: ScreeningInput): Promise<ScreeningOutcome> {
    const base = checkedBaseUrl(this.baseUrl); // throws before any request is built
    const properties: Record<string, string[]> = { name: [input.name] };
    if (input.country) properties.country = [input.country];
    const body = JSON.stringify({
      queries: { q1: { schema: "Company", properties } },
    });
    let res: Response;
    try {
      res = await fetch(`${base}/match/${encodeURIComponent(this.dataset)}`, {
        method: "POST",
        headers: {
          Authorization: `ApiKey ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const timedOut =
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError");
      return { status: "error", code: timedOut ? "timeout" : "upstream" };
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return { status: "error", code: statusCode(res.status) };
    }
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      return { status: "error", code: "bad_response" };
    }
    return mapResponse(parsed, this.dataset);
  }
}
