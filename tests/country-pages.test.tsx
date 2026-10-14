import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Pricing from "@/app/[country]/pricing/page";
import CountryLanding from "@/app/[country]/page";
import { localeFromCookies } from "@/lib/i18n";

const params = (country: string) => ({ params: Promise.resolve({ country }) });
afterEach(() => vi.unstubAllEnvs());

describe("pricing page", () => {
  it("disabled country: waitlist form, no checkout CTA", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    const { container } = render(await Pricing(params("ar")));
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('input[name="email"]')).not.toBeNull();
    expect(container.querySelector('a[href^="/checkout"]')).toBeNull();
    expect(
      screen.queryByText("Activar mi programa de cumplimiento"),
    ).toBeNull();
  });

  it("enabled country: checkout CTA, no waitlist form", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    const { container } = render(await Pricing(params("br")));
    expect(container.querySelector("form")).toBeNull();
    const cta = container.querySelector('a[href^="/checkout"]');
    expect(cta).not.toBeNull();
    expect(cta).toHaveTextContent("Ativar meu programa de compliance");
  });

  it("follows ENABLED_COUNTRIES at request time", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br,ar");
    const { container } = render(await Pricing(params("ar")));
    expect(container.querySelector('a[href^="/checkout"]')).not.toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });

  it("lists all seven components and invents no price", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    const { container } = render(await Pricing(params("br")));
    expect(container.querySelectorAll("li")).toHaveLength(7);
    expect(container.textContent).not.toMatch(/R\$|\$\s?\d|USD|BRL/);
  });

  it("404s for anything but ar|br|mx", async () => {
    await expect(Pricing(params("zz"))).rejects.toThrow();
    await expect(Pricing(params("pt-BR"))).rejects.toThrow();
  });
});

describe("country landing", () => {
  it("disabled country shows the waitlist and never links to checkout", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    const { container } = render(await CountryLanding(params("mx")));
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('a[href^="/checkout"]')).toBeNull();
  });
  it("enabled country has no waitlist", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    const { container } = render(await CountryLanding(params("br")));
    expect(container.querySelector("form")).toBeNull();
  });
});

describe("localeFromCookies", () => {
  const jar = (o: Record<string, string>) => (n: string) => o[n];
  it("lang cookie wins, then country cookie, then English", () => {
    expect(localeFromCookies(jar({ lang: "pt", country: "ar" }))).toBe("pt-BR");
    expect(localeFromCookies(jar({ lang: "es" }))).toBe("es-MX");
    expect(localeFromCookies(jar({ country: "ar" }))).toBe("es-AR");
    expect(localeFromCookies(jar({ country: "other" }))).toBe("en");
    expect(localeFromCookies(jar({ lang: "xx" }))).toBe("en");
    expect(localeFromCookies(jar({}))).toBe("en");
  });
});
