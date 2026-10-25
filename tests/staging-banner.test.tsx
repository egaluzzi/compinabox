// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/br",
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/auth/require-tenant", () => ({
  sessionLocale: async () => "pt-BR",
}));
vi.mock("@/lib/employee/require-employee", () => ({
  employeeLocale: async () => "pt-BR",
}));
vi.mock("@/lib/whistleblower/public-company", () => ({
  loadPublicCompany: async () => ({ locale: "pt-BR" }),
}));

import VisitorLayout from "@/app/(visitor)/layout";
import AppLayout from "@/app/(app)/layout";
import CountryLayout from "@/app/[country]/layout";
import EmployeeLayout from "@/app/employee/layout";
import VendorLayout from "@/app/vendor/layout";
import ReportLayout from "@/app/report/[slug]/layout";

const GROUPS: [string, () => Promise<unknown> | unknown][] = [
  [
    "marketing /{country}",
    () =>
      CountryLayout({
        children: "x",
        params: Promise.resolve({ country: "br" }),
      }),
  ],
  ["visitor (/, /legal, /checkout)", () => VisitorLayout({ children: "x" })],
  ["app (dashboard, onboarding)", () => AppLayout({ children: "x" })],
  ["employee", () => EmployeeLayout({ children: "x" })],
  ["vendor", () => VendorLayout({ children: "x" })],
  [
    "report",
    () =>
      ReportLayout({ children: "x", params: Promise.resolve({ slug: "s" }) }),
  ],
];

const render = async (f: () => Promise<unknown> | unknown) =>
  renderToStaticMarkup((await f()) as React.ReactElement);

afterEach(() => vi.unstubAllEnvs());

describe("staging banner — one per root layout", () => {
  for (const [name, f] of GROUPS) {
    it(`${name}: shown in staging`, async () => {
      vi.stubEnv("APP_ENV", "staging");
      const html = await render(f);
      expect(html).toContain("data-staging-banner");
      expect(html).toContain(
        name.startsWith("visitor")
          ? "Test environment — fictitious data" // language from cookies: default English
          : "Ambiente de teste — dados fictícios",
      );
    });
    it(`${name}: absent in production, development and when unset`, async () => {
      for (const v of ["production", "development", ""]) {
        vi.stubEnv("APP_ENV", v);
        expect(await render(f)).not.toContain("data-staging-banner");
      }
    });
  }
  it("the banner follows the page language (en, es-AR, es-MX)", async () => {
    vi.stubEnv("APP_ENV", "staging");
    const { RootDoc } = await import("@/components/RootDoc");
    const t = (lang: string) =>
      renderToStaticMarkup(RootDoc({ lang, children: "x" }));
    expect(t("en")).toContain("Test environment — fictitious data");
    expect(t("es-AR")).toContain("Ambiente de prueba — datos ficticios");
    expect(t("es-MX")).toContain("Ambiente de pruebas — datos ficticios");
  });
});
