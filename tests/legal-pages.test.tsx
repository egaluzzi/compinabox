// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let cookieJar: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n in cookieJar ? { value: cookieJar[n] } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

import Checkout from "@/app/(visitor)/checkout/page";
import LegalPage from "@/app/(visitor)/legal/[doc]/page";
import { TERMS_VERSION } from "@/lib/legal/version";

const render = async (el: Promise<React.ReactElement>) =>
  renderToStaticMarkup(await el);

beforeEach(() => {
  cookieJar = { lang: "pt" };
  vi.stubEnv("ENABLED_COUNTRIES", "br,ar,mx");
  vi.stubEnv("PAYMENT_PROVIDER", "fake");
  vi.stubEnv("ALLOW_FAKE_PAYMENTS", "true");
  vi.stubEnv("FAKE_PAYMENTS_SECRET", "s".repeat(24));
});
afterEach(() => vi.unstubAllEnvs());

describe("/legal/privacy and /legal/terms", () => {
  for (const doc of ["privacy", "terms"]) {
    it(`${doc}: renders the pt-BR body, the DRAFT banner, highlighted placeholders and the version`, async () => {
      const html = await render(
        LegalPage({ params: Promise.resolve({ doc }) }),
      );
      expect(html).toContain("RASCUNHO");
      expect(html).toContain('lang="pt-BR"');
      expect(html).toContain("data-placeholder");
      expect(html).toContain(TERMS_VERSION);
      expect(html).toMatch(/\[[A-ZÀ-Ú /]+ — a (preencher|definir)/);
    });
  }
  it("a non-Portuguese visitor is told the body is Portuguese only", async () => {
    cookieJar.lang = "en";
    const html = await render(
      LegalPage({ params: Promise.resolve({ doc: "terms" }) }),
    );
    expect(html).toContain("Portuguese only");
  });
  it("the disclaimer page still renders and an unknown doc is a 404", async () => {
    expect(
      await render(
        LegalPage({ params: Promise.resolve({ doc: "disclaimer" }) }),
      ),
    ).toContain("RASCUNHO");
    await expect(
      LegalPage({ params: Promise.resolve({ doc: "nope" }) }),
    ).rejects.toThrow("notFound");
  });
});

describe("/checkout shows the terms checkbox", () => {
  for (const [c, accept] of [
    ["br", "Li e aceito os"],
    ["ar", "Leí y acepto los"],
    ["mx", "He leído y acepto los"],
  ] as const) {
    it(`${c}: required checkbox linking both documents`, async () => {
      const html = await render(
        Checkout({ searchParams: Promise.resolve({ c }) }),
      );
      expect(html).toContain('name="terms"');
      expect(html).toContain('type="checkbox"');
      expect(html).toContain(accept);
      expect(html).toContain('href="/legal/terms"');
      expect(html).toContain('href="/legal/privacy"');
    });
  }
  it("generic English visitor (cookie lang=en) sees the English text", async () => {
    cookieJar.lang = "en";
    const html = await render(
      Checkout({ searchParams: Promise.resolve({ c: "br" }) }),
    );
    // country in the query decides the language: br -> pt-BR
    expect(html).toContain("Li e aceito os");
  });
});
