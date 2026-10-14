import { NextResponse, type NextRequest } from "next/server";
import { redirectLocation, resolveGeoRedirect } from "@/lib/geo";
import {
  mergeUtm,
  parseUtmCookie,
  serializeUtm,
  UTM_COOKIE,
  UTM_MAX_AGE,
  utmFromParams,
} from "@/lib/utm";

// Next 16 renamed the `middleware` file convention to `proxy`.
// Two jobs: (1) geo redirect from `/` only (SPEC §3.2; decision in lib/geo.ts);
// (2) UTM capture on the marketing pages, only after cookie consent (LGPD caution).
export function proxy(request: NextRequest) {
  const target = resolveGeoRedirect({
    pathname: request.nextUrl.pathname,
    countryCookie: request.cookies.get("country")?.value,
    cfCountry: request.headers.get("cf-ipcountry"),
  });

  let response: NextResponse;
  if (target) {
    // 307 + no-store: the answer depends on the visitor, and Cloudflare sits in front.
    // Location is built from APP_URL: behind Caddy request.url carries the internal scheme/host.
    response = NextResponse.redirect(
      redirectLocation(target, request.url, process.env.APP_URL),
      307,
    );
    response.headers.set("Cache-Control", "no-store");
  } else {
    response = NextResponse.next();
  }

  // Consent first: no `consent=accepted`, no UTM cookie. Last non-empty touch wins.
  if (request.cookies.get("consent")?.value === "accepted") {
    const incoming = utmFromParams(request.nextUrl.searchParams);
    const merged = mergeUtm(
      parseUtmCookie(request.cookies.get(UTM_COOKIE)?.value),
      incoming,
    );
    const changed =
      merged && serializeUtm(merged) !== request.cookies.get(UTM_COOKIE)?.value;
    if (merged && changed) {
      response.cookies.set(UTM_COOKIE, serializeUtm(merged), {
        path: "/",
        maxAge: UTM_MAX_AGE,
        sameSite: "lax",
        secure: (process.env.APP_URL ?? "").startsWith("https:"),
      });
    }
  }
  return response;
}

// `/` for geo; the marketing pages and /checkout for UTM. Geo logic still acts on `/` only.
export const config = {
  matcher: ["/", "/ar/:path*", "/br/:path*", "/mx/:path*", "/checkout"],
};
