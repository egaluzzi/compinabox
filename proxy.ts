import { NextResponse, type NextRequest } from "next/server";
import { redirectLocation, resolveGeoRedirect } from "@/lib/geo";
import { isStaging } from "@/lib/env";
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
  const response = marketingProxy(request);
  // Staging is never indexed (CLAUDE.md §9): every response the app produces says so.
  if (isStaging()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

/** The pages geo detection and UTM capture apply to (the matcher is wider since phase 9). */
const MARKETING = /^\/(?:|(?:ar|br|mx)(?:\/.*)?|checkout)$/;

function marketingProxy(request: NextRequest) {
  if (!MARKETING.test(request.nextUrl.pathname)) return NextResponse.next();
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
  // Everything except Next's static assets: geo/UTM still apply to MARKETING paths only; the rest
  // passes through so the staging X-Robots-Tag covers every page and handler.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
