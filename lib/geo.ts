import { isCountry, type Country } from "./countries";

/** Values of the `country` cookie: a chosen market, or "other" = show the picker. */
export const COUNTRY_COOKIE_VALUES = ["ar", "br", "mx", "other"] as const;

export type GeoInput = {
  pathname: string;
  countryCookie: string | undefined;
  /** Raw CF-IPCountry header value; absent outside Cloudflare. */
  cfCountry: string | null | undefined;
};

/**
 * Decides whether a request should be redirected to a country page.
 * Only `/` is ever redirected (SPEC §3.2). The cookie beats the header;
 * an invalid cookie is ignored. Returns the country to redirect to, or null.
 */
export function resolveGeoRedirect({
  pathname,
  countryCookie,
  cfCountry,
}: GeoInput): Country | null {
  if (pathname !== "/") return null;

  if (countryCookie !== undefined) {
    if (isCountry(countryCookie)) return countryCookie;
    if (countryCookie === "other") return null;
    // invalid cookie: fall through to the header
  }

  const header = cfCountry?.trim().toLowerCase();
  return isCountry(header) ? header : null;
}

/**
 * Absolute redirect target. Behind Caddy the process sees an internal scheme/host in
 * `request.url`, so APP_URL (the public origin) wins when it is set and parses;
 * otherwise fall back to the request's own URL.
 */
export function redirectLocation(
  country: Country,
  requestUrl: string,
  appUrl: string | undefined,
): URL {
  if (appUrl) {
    try {
      return new URL(`/${country}`, new URL(appUrl).origin);
    } catch {
      // invalid APP_URL: fall through
    }
  }
  return new URL(`/${country}`, requestUrl);
}
