import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CountryBlog from "@/app/[country]/blog/page";
import CountryArticle, {
  generateMetadata as articleMeta,
} from "@/app/[country]/blog/[slug]/page";
import GenericBlog from "@/app/(visitor)/blog/page";
import GenericArticle from "@/app/(visitor)/blog/[slug]/page";
import sitemap from "@/app/sitemap";
import { ArticleView } from "@/components/blog/BlogViews";
import { listArticles } from "@/lib/blog";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const c = (country: string) => ({ params: Promise.resolve({ country }) });
const cs = (country: string, slug: string) => ({
  params: Promise.resolve({ country, slug }),
});
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;

describe("blog routes", () => {
  it("/br/blog lists the four drafts with the draft label", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    const { container } = render(await CountryBlog(c("br")));
    expect(container.querySelectorAll("li")).toHaveLength(4);
    expect(container.textContent).toContain("RASCUNHO — pendente de revisão");
  });

  it("/blog (generic, English) lists the three drafts", () => {
    const { container } = render(GenericBlog());
    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(container.textContent).toContain("DRAFT — pending review");
  });

  it("/ar/blog and /mx/blog are 404 (no articles yet); a disabled br blog is 404 too", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br,ar,mx");
    await expect(CountryBlog(c("ar"))).rejects.toThrow(NOT_FOUND);
    await expect(CountryBlog(c("mx"))).rejects.toThrow(NOT_FOUND);
    vi.stubEnv("ENABLED_COUNTRIES", "ar");
    await expect(CountryBlog(c("br"))).rejects.toThrow(NOT_FOUND);
    await expect(
      CountryArticle(cs("br", listArticles("br")[0].slug)),
    ).rejects.toThrow(NOT_FOUND);
  });

  it("unknown slug and path-looking slugs are 404; an English slug does not resolve under /br", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    await expect(CountryArticle(cs("br", "nope"))).rejects.toThrow(NOT_FOUND);
    await expect(CountryArticle(cs("br", "../../etc/passwd"))).rejects.toThrow(
      NOT_FOUND,
    );
    await expect(
      CountryArticle(cs("br", listArticles("generic")[0].slug)),
    ).rejects.toThrow(NOT_FOUND);
    await expect(
      GenericArticle({
        params: Promise.resolve({ slug: listArticles("br")[0].slug }),
      }),
    ).rejects.toThrow(NOT_FOUND);
  });

  it("an article renders its banner, one h1, Article JSON-LD, and a link back", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    const a = listArticles("br")[0];
    const { container } = render(await CountryArticle(cs("br", a.slug)));
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.textContent).toContain("RASCUNHO — pendente de revisão");
    const ld = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')!
        .textContent!,
    );
    expect(ld).toMatchObject({
      "@type": "Article",
      headline: a.title,
      inLanguage: "pt-BR",
      datePublished: a.published,
    });
    expect(container.querySelector('a[href="/br/blog"]')).not.toBeNull();
  });

  it("draft article metadata is noindex with a canonical URL and its own title/description", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br");
    const a = listArticles("br")[0];
    const m = await articleMeta(cs("br", a.slug));
    expect(m.robots).toMatchObject({ index: false });
    expect(m.alternates?.canonical).toBe(`/br/blog/${a.slug}`);
    expect(m.alternates?.languages).toBeUndefined();
    expect(m.description).toBe(a.description);
  });

  it("escapes HTML in article text", () => {
    const article = {
      ...listArticles("br")[0],
      blocks: [
        {
          t: "p" as const,
          inline: [
            { t: "text" as const, text: "<img src=x onerror=alert(1)>" },
          ],
        },
      ],
    };
    const { container } = render(
      <ArticleView scope="br" locale="pt-BR" article={article} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });

  it("sitemap has no /blog URL while every article is a draft", () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br,ar,mx");
    expect(sitemap().filter((e) => e.url.includes("/blog"))).toEqual([]);
  });
});
