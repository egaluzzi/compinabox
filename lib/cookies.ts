import {
  mergeUtm,
  parseUtmCookie,
  serializeUtm,
  UTM_COOKIE,
  UTM_MAX_AGE,
  utmFromParams,
} from "./utm";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Client-side cookie writer: 1 year, path /, SameSite=Lax. */
export function setCookie(name: string, value: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure}`;
}

export function getCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/** After the visitor accepts the banner: store the current URL's UTM params (30 days), if any. */
export function captureUtmFromUrl(): void {
  const incoming = utmFromParams(new URLSearchParams(window.location.search));
  const merged = mergeUtm(parseUtmCookie(getCookie(UTM_COOKIE)), incoming);
  if (!merged) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${UTM_COOKIE}=${encodeURIComponent(serializeUtm(merged))}; Max-Age=${UTM_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}
