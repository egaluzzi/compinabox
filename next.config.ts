import type { NextConfig } from "next";

// Authenticated pages: never cached by a shared cache, never framed, no referrer leakage
// beyond our own origin. (No full CSP yet — scripts/styles are out of scope for phase 4.)
const AUTHENTICATED_HEADERS = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return ["/dashboard/:path*", "/onboarding", "/login"].map((source) => ({
      source,
      headers: AUTHENTICATED_HEADERS,
    }));
  },
};

export default nextConfig;
