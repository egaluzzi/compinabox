import { NextResponse, type NextRequest } from "next/server";
import { resolveGeoRedirect } from "@/lib/geo";

// Next 16 renamed the `middleware` file convention to `proxy`.
// Geo redirect from `/` only (SPEC §3.2); the decision lives in lib/geo.ts.
export function proxy(request: NextRequest) {
  const target = resolveGeoRedirect({
    pathname: request.nextUrl.pathname,
    countryCookie: request.cookies.get("country")?.value,
    cfCountry: request.headers.get("cf-ipcountry"),
  });
  if (!target) return NextResponse.next();

  // 307 + no-store: the answer depends on the visitor, and Cloudflare sits in front.
  const response = NextResponse.redirect(
    new URL(`/${target}`, request.url),
    307,
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: "/" };
