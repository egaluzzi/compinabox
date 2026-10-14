import type { Metadata } from "next";
import {
  countryMetadata,
  loadCountry,
  type CountryParams,
} from "@/lib/country-page";

export function generateMetadata({ params }: CountryParams): Promise<Metadata> {
  return countryMetadata(params, {
    suffix: "/legal-basis",
    title: (t) => `${t("landing.minTitle")} | ${t("brand.name")}`,
  });
}

export default async function LegalBasis({ params }: CountryParams) {
  const { t } = await loadCountry(params);
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">{t("landing.minTitle")}</h1>
      <p className="text-slate-700">{t("landing.min")}</p>
      <p className="italic text-slate-700">{t("landing.minNote")}</p>
    </div>
  );
}
