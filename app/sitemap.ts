import type { MetadataRoute } from "next";
import { listArticles, blogPath } from "@/lib/blog";
import { getEnabledCountries } from "@/lib/countries";
import { isStaging } from "@/lib/env";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const SUBPAGES = ["", "/pricing", "/how-it-works", "/faq", "/legal-basis"];

// Enabled countries only (disabled ones are noindex), plus `/`.
export default function sitemap(): MetadataRoute.Sitemap {
  if (isStaging()) return []; // staging is never indexed
  const base = siteUrl();
  const paths = [
    "/",
    ...getEnabledCountries().flatMap((c) => SUBPAGES.map((s) => `/${c}${s}`)),
  ];
  // Published articles only (drafts are noindex and stay out), enabled countries only.
  for (const scope of ["generic", ...getEnabledCountries()] as const) {
    const published = listArticles(scope).filter(
      (a) => a.status === "published",
    );
    if (published.length > 0)
      paths.push(
        blogPath(scope),
        ...published.map((a) => `${blogPath(scope)}/${a.slug}`),
      );
  }
  return paths.map((p) => ({ url: new URL(p, base).toString() }));
}
