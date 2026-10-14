// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("security headers for authenticated pages (next.config)", () => {
  it("dashboard, onboarding and login send private/no-store, frame denial and same-origin referrer", async () => {
    const rules = await nextConfig.headers!();
    expect(rules.map((r) => r.source).sort()).toEqual(
      [
        "/dashboard/:path*",
        "/dashboard/documents/:id/pdf",
        "/login",
        "/onboarding",
      ].sort(),
    );
    for (const rule of rules.filter((r) => !r.source.endsWith("/pdf"))) {
      const h = Object.fromEntries(rule.headers.map((x) => [x.key, x.value]));
      expect(h["Cache-Control"]).toBe("private, no-store");
      expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["Referrer-Policy"]).toBe("same-origin");
    }
  });

  it("the PDF route keeps Cache-Control: no-store (declared after the general rule, so it wins)", async () => {
    const rules = await nextConfig.headers!();
    const last = rules[rules.length - 1];
    expect(last.source).toBe("/dashboard/documents/:id/pdf");
    expect(last.headers).toEqual([{ key: "Cache-Control", value: "no-store" }]);
  });
});
