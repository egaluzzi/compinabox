export const UTM_COOKIE = "utm";
export const UTM_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type Utm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

const MAX_LEN = 100;

/** Letters, digits and a few separators only; length-capped. Empty -> null. */
export function sanitizeUtm(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value
    .replace(/[^\p{L}\p{N} _.\-+]/gu, "")
    .trim()
    .slice(0, MAX_LEN);
  return clean === "" ? null : clean;
}

export function utmFromParams(params: {
  get(name: string): string | null;
}): Utm {
  return {
    source: sanitizeUtm(params.get("utm_source")),
    medium: sanitizeUtm(params.get("utm_medium")),
    campaign: sanitizeUtm(params.get("utm_campaign")),
  };
}

export const hasUtm = (u: Utm) => !!(u.source || u.medium || u.campaign);

/** Last non-empty touch wins: a touch with any UTM param replaces the stored set wholesale. */
export function mergeUtm(existing: Utm | null, incoming: Utm): Utm | null {
  return hasUtm(incoming) ? incoming : existing;
}

/** Raw JSON value; the cookie APIs (Next, or encodeURIComponent on the client) do the wire encoding. */
export const serializeUtm = (u: Utm) => JSON.stringify(u);

export function parseUtmCookie(raw: string | undefined): Utm | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const u: Utm = {
      source: sanitizeUtm(typeof o.source === "string" ? o.source : null),
      medium: sanitizeUtm(typeof o.medium === "string" ? o.medium : null),
      campaign: sanitizeUtm(typeof o.campaign === "string" ? o.campaign : null),
    };
    return hasUtm(u) ? u : null;
  } catch {
    return null;
  }
}
