import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/blog/BlogViews";
import { blogAvailable, getArticle } from "@/lib/blog";
import { loadCountry } from "@/lib/country-page";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ country: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { country, t } = await loadCountry(params);
  const a = getArticle(country, slug);
  if (!a) return {};
  return pageMetadata({
    title: `${a.title} | ${t("brand.name")}`,
    description: a.description,
    canonical: `/${country}/blog/${a.slug}`,
    noindex: a.status === "draft",
  });
}

export default async function CountryArticle({ params }: Props) {
  const { slug } = await params;
  const { country, locale } = await loadCountry(params);
  const article = blogAvailable(country) ? getArticle(country, slug) : undefined;
  if (!article) notFound();
  return <ArticleView scope={country} locale={locale} article={article} />;
}
