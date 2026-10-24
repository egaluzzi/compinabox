// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const root = path.resolve(__dirname, "..");
const EMPLOYEE = "app/employee";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const entries = () =>
  walk(path.join(root, EMPLOYEE))
    .filter((f) => /\/(page\.tsx|route\.ts)$/.test(f))
    .map((f) => path.relative(path.join(root, EMPLOYEE), f))
    .sort();
const src = (rel: string) =>
  readFileSync(path.join(root, EMPLOYEE, rel), "utf8");

const CALLS_GATE = /\brequireEmployee(Route)?\(/;
/**
 * The ONLY entry points under app/employee allowed to skip the gate, and why:
 *  - [token]/page.tsx        the link-entry page (read-only; consumes nothing)
 *  - link-invalid/page.tsx   the friendly page every failure lands on (no session exists)
 *  - api/session/route.ts    the Start button's exchange: how a session is obtained
 */
const EXEMPT = [
  "[token]/page.tsx",
  "api/session/route.ts",
  "link-invalid/page.tsx",
];

describe("requireEmployee coverage (app/employee)", () => {
  it("the scan sees every portal entry point (not vacuous)", () => {
    expect(entries()).toEqual(
      [
        "[token]/page.tsx",
        "api/acknowledge/route.ts",
        "api/disclosure/route.ts",
        "api/session/route.ts",
        "api/sign-out/route.ts",
        "api/training/route.ts",
        "disclosure/page.tsx",
        "documents/[id]/page.tsx",
        "link-invalid/page.tsx",
        "page.tsx",
        "training/[n]/page.tsx",
        "training/quiz/page.tsx",
      ].sort(),
    );
  });

  it("every page.tsx and route.ts calls requireEmployee()/requireEmployeeRoute(), except the three exempt ones", () => {
    const ungated = entries()
      .filter((f) => !EXEMPT.includes(f))
      .filter((f) => !CALLS_GATE.test(src(f)));
    expect(ungated).toEqual([]);
  });

  it("the exempt pages and the exchange route never read the portal session or a company", () => {
    for (const f of EXEMPT)
      expect(src(f), f).not.toMatch(/getPortalEmployee|requireEmployee/);
  });

  it("no employee file reads company_id/employee_id from the request (route/search params, body, form)", () => {
    const offenders = walk(path.join(root, EMPLOYEE))
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .filter((f) =>
        /(formData|form|searchParams|params|body|query|\.json\(\))[^;\n]*(company|employee)_?id/i.test(
          readFileSync(f, "utf8"),
        ),
      )
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });

  it("detects a file that skips the gate (the predicate works)", () => {
    expect(CALLS_GATE.test("export default async function P() {}")).toBe(false);
    expect(CALLS_GATE.test("const ctx = await requireEmployee();")).toBe(true);
    expect(CALLS_GATE.test("await requireEmployeeRoute(request)")).toBe(true);
  });
});

describe("security headers for /employee (next.config)", () => {
  it("pages are private/no-store, no-referrer, framed never, noindex", async () => {
    const rules = (await nextConfig.headers!()).filter((r) =>
      r.source.startsWith("/employee"),
    );
    expect(rules.map((r) => r.source).sort()).toEqual([
      "/employee",
      "/employee/:path*",
    ]);
    for (const rule of rules) {
      const h = Object.fromEntries(rule.headers.map((x) => [x.key, x.value]));
      expect(h["Cache-Control"]).toBe("private, no-store");
      expect(h["Referrer-Policy"]).toBe("no-referrer");
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
      expect(h["X-Robots-Tag"]).toBe("noindex, nofollow");
    }
  });
});
