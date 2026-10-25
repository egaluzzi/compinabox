import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/blog/BlogViews";
import { blogAvailable, getArticle } from "@/lib/blog";
import { getT } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle("generic", slug);
  if (!a) return {};
  return pageMetadata({
    title: `${a.title} | ${getT("en")("brand.name")}`,
    description: a.description,
    canonical: `/blog/${a.slug}`,
    noindex: a.status === "draft",
  });
}

export default async function GenericArticle({ params }: Props) {
  const { slug } = await params;
  const article = blogAvailable("generic") ? getArticle("generic", slug) : undefined;
  if (!article) notFound();
  return <ArticleView scope="generic" locale="en" article={article} />;
}
