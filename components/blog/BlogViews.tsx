import Link from "next/link";
import { Fragment } from "react";
import { JsonLd } from "@/components/JsonLd";
import { blogPath, type BlogScope } from "@/lib/blog";
import {
  readingMinutes,
  type Article,
  type Block,
  type Inline,
} from "@/lib/blog/parse";
import { getT, type Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((x, i) => {
        if (x.t === "strong") return <strong key={i}>{x.text}</strong>;
        if (x.t === "em") return <em key={i}>{x.text}</em>;
        if (x.t === "link")
          return x.href.startsWith("/") ? (
            <Link key={i} href={x.href} className="underline">
              {x.text}
            </Link>
          ) : (
            <a
              key={i}
              href={x.href}
              rel="noopener noreferrer"
              className="underline"
            >
              {x.text}
            </a>
          );
        return <Fragment key={i}>{x.text}</Fragment>;
      })}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2":
            return (
              <h2 key={i} className="mt-8 text-2xl font-semibold">
                <Inlines items={b.inline} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-6 text-xl font-semibold">
                <Inlines items={b.inline} />
              </h3>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-4 border-slate-300 pl-4 text-slate-700"
              >
                <Inlines items={b.inline} />
              </blockquote>
            );
          case "ul":
          case "ol": {
            const Tag = b.t;
            return (
              <Tag
                key={i}
                className={`${b.t === "ul" ? "list-disc" : "list-decimal"} space-y-1 pl-6`}
              >
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines items={it} />
                  </li>
                ))}
              </Tag>
            );
          }
          default:
            return (
              <p key={i}>
                <Inlines items={b.inline} />
              </p>
            );
        }
      })}
    </>
  );
}

export function DraftBadge({ label }: { label: string }) {
  return (
    <p className="inline-block rounded bg-amber-100 px-2 py-1 text-sm font-semibold text-amber-900">
      {label}
    </p>
  );
}

export function BlogIndexView({
  scope,
  locale,
  articles,
}: {
  scope: BlogScope;
  locale: Locale;
  articles: Article[];
}) {
  const t = getT(locale);
  const base = blogPath(scope);
  return (
    <div lang={locale} className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">{t("blog.title")}</h1>
      <p className="text-slate-700">{t("blog.intro")}</p>
      {articles.length === 0 && <p>{t("blog.empty")}</p>}
      <ul className="space-y-6">
        {articles.map((a) => (
          <li key={a.slug} className="space-y-1 border-t border-slate-200 pt-4">
            {a.status === "draft" && <DraftBadge label={t("blog.draft")} />}
            <h2 className="text-xl font-semibold">
              <Link href={`${base}/${a.slug}`} className="hover:underline">
                {a.title}
              </Link>
            </h2>
            <p className="text-slate-700">{a.description}</p>
            <p className="text-sm text-slate-600">
              {t("blog.minRead", { minutes: readingMinutes(a.words) })} ·{" "}
              <Link href={`${base}/${a.slug}`} className="underline">
                {t("blog.readMore")}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function articleJsonLd(
  a: Article,
  scope: BlogScope,
  locale: Locale,
  brand: string,
) {
  const url = new URL(`${blogPath(scope)}/${a.slug}`, siteUrl()).toString();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    datePublished: a.published,
    dateModified: a.updated,
    inLanguage: locale,
    author: { "@type": "Organization", name: brand },
    publisher: { "@type": "Organization", name: brand },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

export function ArticleView({
  scope,
  locale,
  article,
}: {
  scope: BlogScope;
  locale: Locale;
  article: Article;
}) {
  const t = getT(locale);
  return (
    <article lang={locale} className="max-w-prose space-y-4 leading-relaxed">
      <JsonLd data={articleJsonLd(article, scope, locale, t("brand.name"))} />
      <p>
        <Link href={blogPath(scope)} className="text-sm underline">
          ← {t("blog.back")}
        </Link>
      </p>
      {article.status === "draft" && <DraftBadge label={t("blog.draft")} />}
      <h1 className="text-3xl font-bold leading-tight">{article.title}</h1>
      <p className="text-sm text-slate-600">
        <time dateTime={article.published}>{article.published}</time> ·{" "}
        {t("blog.minRead", { minutes: readingMinutes(article.words) })}
      </p>
      <Blocks blocks={article.blocks} />
    </article>
  );
}
