import type { MetadataRoute } from "next";
import { getEnabledCountries } from "@/lib/countries";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const SUBPAGES = ["", "/pricing", "/how-it-works", "/faq", "/legal-basis"];

// Enabled countries only (disabled ones are noindex), plus `/`.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const paths = [
    "/",
    ...getEnabledCountries().flatMap((c) => SUBPAGES.map((s) => `/${c}${s}`)),
  ];
  return paths.map((p) => ({ url: new URL(p, base).toString() }));
}
