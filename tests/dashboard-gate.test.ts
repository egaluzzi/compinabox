// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/** page.tsx / route.ts files (the entry points that serve a request). Layouts are not gates. */
const isEntry = (f: string) => /\/(page\.tsx|route\.ts)$/.test(f);
const CALLS_GATE = /\brequireTenant(Route)?\(\)/;

/** Returns the entry points under `dirs` that do not call the gate themselves. */
export function ungated(dirs: string[]): string[] {
  return dirs
    .flatMap((d) => walk(path.join(root, d)))
    .filter(isEntry)
    .filter((f) => !CALLS_GATE.test(readFileSync(f, "utf8")))
    .map((f) => path.relative(root, f));
}

// Tenant-bound entry points outside the dashboard tree that must also use the gate.
const DASHBOARD = "app/(app)/dashboard";
const EXTRA_TENANT_ROUTES = ["app/api/documents"];

describe("requireTenant coverage", () => {
  it("every page.tsx and route.ts under app/(app)/dashboard calls requireTenant()/requireTenantRoute()", () => {
    expect(ungated([DASHBOARD])).toEqual([]);
  });

  it("tenant-bound API routes outside the dashboard tree use the gate too", () => {
    expect(ungated(EXTRA_TENANT_ROUTES)).toEqual([]);
  });

  it("the scan sees the eight sections, the document pages, the whistleblower case routes and the settings route (not vacuous)", () => {
    const entries = walk(path.join(root, DASHBOARD))
      .filter(isEntry)
      .map((f) => path.relative(path.join(root, DASHBOARD), f))
      .sort();
    expect(entries).toEqual(
      [
        "billing/page.tsx",
        "documents/[id]/page.tsx",
        "documents/[id]/pdf/route.ts",
        "documents/page.tsx",
        "employees/page.tsx",
        "page.tsx",
        "settings/page.tsx",
        "settings/save/route.ts",
        "training/page.tsx",
        "vendors/page.tsx",
        "whistleblower/[id]/evidence/[evidenceId]/route.ts",
        "whistleblower/[id]/note/route.ts",
        "whistleblower/[id]/page.tsx",
        "whistleblower/[id]/status/route.ts",
        "whistleblower/page.tsx",
      ].sort(),
    );
  });

  it("detects a page that skips the gate (the check itself works)", () => {
    // A synthetic entry in a temp dir under the repo would be noise; test the predicate instead.
    expect(
      CALLS_GATE.test("export default async function P() { return null }"),
    ).toBe(false);
    expect(CALLS_GATE.test("const x = await getTenant();")).toBe(false);
    expect(CALLS_GATE.test("const { t } = await requireTenant();")).toBe(true);
    expect(CALLS_GATE.test("const g = await requireTenantRoute();")).toBe(true);
  });

  it("no dashboard file uses getTenant directly (the helper is the only way in)", () => {
    const offenders = walk(path.join(root, DASHBOARD))
      .filter((f) => /getTenant\b/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
});
