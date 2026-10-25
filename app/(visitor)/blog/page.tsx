import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndexView } from "@/components/blog/BlogViews";
import { blogAvailable, listArticles } from "@/lib/blog";
import { getT } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

// The generic blog is in English whatever the visitor's `lang` cookie says (the articles are English).
const t = getT("en");

export function generateMetadata(): Metadata {
  const published = listArticles("generic").some((a) => a.status === "published");
  return pageMetadata({
    title: `${t("blog.title")} | ${t("brand.name")}`,
    description: t("blog.intro"),
    canonical: "/blog",
    noindex: !published,
  });
}

export default function GenericBlog() {
  if (!blogAvailable("generic")) notFound();
  return <BlogIndexView scope="generic" locale="en" articles={listArticles("generic")} />;
}
