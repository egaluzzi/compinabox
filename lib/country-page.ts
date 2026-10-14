import { notFound } from "next/navigation";
import { isCountry, isCountryEnabled, type Country } from "./countries";
import { COUNTRY_LOCALE, getT } from "./i18n";
import { alternatesFor, pageMetadata } from "./seo";

export type CountryParams = { params: Promise<{ country: string }> };

/** Resolves a route param to everything a country page needs. 404s on anything but ar|br|mx. */
export async function loadCountry(params: CountryParams["params"]) {
  const { country } = await params;
  if (!isCountry(country)) notFound();
  const locale = COUNTRY_LOCALE[country as Country];
  return {
    country: country as Country,
    locale,
    t: getT(locale),
    enabled: isCountryEnabled(country as Country),
  };
}

/** Disabled countries render normally but are noindex (CLAUDE.md §2). */
export async function countryMetadata(
  params: CountryParams["params"],
  page: {
    suffix: string;
    title: (t: ReturnType<typeof getT>) => string;
    landing?: boolean;
  },
) {
  const { country, t, enabled } = await loadCountry(params);
  return pageMetadata({
    title: page.title(t),
    description: t("landing.metaDescription"),
    canonical: `/${country}${page.suffix}`,
    languages: alternatesFor(page.suffix, { includeEn: !!page.landing }),
    noindex: !enabled,
  });
}
