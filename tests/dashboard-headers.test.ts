// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("security headers for authenticated pages (next.config)", () => {
  it("dashboard, onboarding and login send private/no-store, frame denial and same-origin referrer", async () => {
    const rules = await nextConfig.headers!();
    expect(rules.map((r) => r.source).sort()).toEqual(
      ["/dashboard/:path*", "/login", "/onboarding"].sort(),
    );
    for (const rule of rules) {
      const h = Object.fromEntries(rule.headers.map((x) => [x.key, x.value]));
      expect(h["Cache-Control"]).toBe("private, no-store");
      expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["Referrer-Policy"]).toBe("same-origin");
    }
  });
});
