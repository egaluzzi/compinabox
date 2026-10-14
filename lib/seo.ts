import type { Metadata } from "next";
import { COUNTRIES, type Country } from "./countries";
import { COUNTRY_LOCALE } from "./i18n";

export function siteUrl(): URL {
  try {
    return new URL(process.env.APP_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

/**
 * hreflang uses locale codes as keys; hrefs use URL prefixes (CLAUDE.md §5).
 * `suffix` is the page path under the country ("" for the landing).
 * The landing set also carries `en` -> `/`; `/` is x-default everywhere.
 */
export function alternatesFor(suffix: string, opts: { includeEn: boolean }) {
  const languages: Record<string, string> = {};
  if (opts.includeEn) languages.en = "/";
  for (const c of COUNTRIES) languages[COUNTRY_LOCALE[c]] = `/${c}${suffix}`;
  languages["x-default"] = "/";
  return languages;
}

export function pageMetadata(args: {
  title: string;
  description: string;
  canonical: string;
  languages?: Record<string, string>;
  noindex?: boolean;
}): Metadata {
  return {
    metadataBase: siteUrl(),
    title: args.title,
    description: args.description,
    alternates: { canonical: args.canonical, languages: args.languages },
    robots: args.noindex ? { index: false, follow: true } : undefined,
  };
}

export function organizationJsonLd(name: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: siteUrl().toString(),
    description,
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export type { Country };
