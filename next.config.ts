import type { NextConfig } from "next";

// Authenticated pages: never cached by a shared cache, never framed, no referrer leakage
// beyond our own origin. (No full CSP yet — scripts/styles are out of scope for phase 4.)
const AUTHENTICATED_HEADERS = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
];

// The public whistleblower channel (pages and handlers): nothing cached, no referrer, no framing,
// not indexed. It sets no cookies. (Handlers also set these themselves: lib/whistleblower/http.ts.)
const REPORT_HEADERS = [
  { key: "Cache-Control", value: "no-store" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      ...["/dashboard/:path*", "/onboarding", "/login"].map((source) => ({
        source,
        headers: AUTHENTICATED_HEADERS,
      })),
      ...["/report/:path*", "/api/report/:path*"].map((source) => ({
        source,
        headers: REPORT_HEADERS,
      })),
      // Later rules win per key: the PDF keeps the `Cache-Control: no-store` its route handler
      // set in phase 3 (tests/documents-routes.test.ts, smoke) — still uncacheable, still private.
      {
        source: "/dashboard/documents/:id/pdf",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
