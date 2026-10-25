import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndexView } from "@/components/blog/BlogViews";
import { blogAvailable, listArticles } from "@/lib/blog";
import { loadCountry, type CountryParams } from "@/lib/country-page";
import { pageMetadata } from "@/lib/seo";

// Index lists drafts (so the team can read them) but is noindex until something is published.
export async function generateMetadata({ params }: CountryParams): Promise<Metadata> {
  const { country, t } = await loadCountry(params);
  const published = listArticles(country).some((a) => a.status === "published");
  return pageMetadata({
    title: `${t("blog.title")} | ${t("brand.name")}`,
    description: t("blog.intro"),
    canonical: `/${country}/blog`,
    noindex: !published,
  });
}

export default async function CountryBlog({ params }: CountryParams) {
  const { country, locale } = await loadCountry(params);
  if (!blogAvailable(country)) notFound();
  return <BlogIndexView scope={country} locale={locale} articles={listArticles(country)} />;
}
