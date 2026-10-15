import { cache } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import type { Country } from "@/lib/countries";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import { findCompanyBySlug } from "./company-slug";

/** The company behind /report/<slug>, its locale and translator; 404 for an unknown slug. */
export const loadPublicCompany = cache(async (slug: string) => {
  const company = await findCompanyBySlug(getDb(), slug);
  if (!company) notFound();
  const locale = COUNTRY_LOCALE[company.country as Country] ?? "en";
  return { company, locale, t: getT(locale) };
});
