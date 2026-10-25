// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blog", async (orig) => {
  const real = await orig<typeof import("@/lib/blog")>();
  const mk = (slug: string, status: "draft" | "published") =>
    ({ slug, status }) as never;
  return {
    ...real,
    listArticles: (scope: string) =>
      scope === "br"
        ? [mk("pub", "published"), mk("drf", "draft")]
        : scope === "generic"
          ? [mk("g-draft", "draft")]
          : [],
  };
});
import sitemap from "@/app/sitemap";

afterEach(() => vi.unstubAllEnvs());

describe("sitemap and blog", () => {
  it("lists published articles (and the index) of enabled countries only, never drafts", () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    const urls = sitemap()
      .map((e) => new URL(e.url).pathname)
      .filter((p) => p.includes("/blog"));
    expect(urls).toEqual(["/br/blog", "/br/blog/pub"]);
    vi.stubEnv("ENABLED_COUNTRIES", "ar");
    expect(sitemap().some((e) => e.url.includes("/blog"))).toBe(false);
  });
});
