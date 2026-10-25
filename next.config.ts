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

// The tokenized employee portal (pages and handlers; handlers also set these themselves, see
// lib/employee/require-employee.ts). The session cookie is scoped to Path=/employee, so none of
// this ever reaches /dashboard, /report or the marketing site.
const EMPLOYEE_HEADERS = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

// The tokenized vendor questionnaire (pages and handlers; the handler also sets these itself, see
// lib/vendors/constants.ts). The link is in the URL, so: no referrer, no cache, not indexed.
const VENDOR_HEADERS = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Blog articles are read from disk at request time; make sure the standalone build ships them.
  outputFileTracingIncludes: { "/**": ["./content/blog/**/*.md"] },
  async headers() {
    return [
      ...["/dashboard/:path*", "/onboarding", "/login"].map((source) => ({
        source,
        headers: AUTHENTICATED_HEADERS,
      })),
      ...["/employee", "/employee/:path*"].map((source) => ({
        source,
        headers: EMPLOYEE_HEADERS,
      })),
      ...["/vendor/:path*"].map((source) => ({
        source,
        headers: VENDOR_HEADERS,
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
