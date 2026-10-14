import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Waitlist } from "@/components/Waitlist";
import {
  countryMetadata,
  loadCountry,
  type CountryParams,
} from "@/lib/country-page";
import { organizationJsonLd } from "@/lib/seo";

export function generateMetadata({ params }: CountryParams): Promise<Metadata> {
  return countryMetadata(params, {
    suffix: "",
    title: (t) => t("landing.metaTitle"),
    landing: true,
  });
}

export default async function CountryLanding({ params }: CountryParams) {
  const { country, t, enabled } = await loadCountry(params);
  const base = `/${country}`;
  const btn = "inline-block rounded-lg px-5 py-3 font-semibold";
  return (
    <div className="space-y-12">
      <JsonLd
        data={organizationJsonLd(t("brand.name"), t("landing.metaDescription"))}
      />

      <section className="space-y-4">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {t("landing.hero")}
        </h1>
        <p className="max-w-3xl text-lg text-slate-700">{t("landing.sub")}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={`${base}/pricing`}
            className={`${btn} bg-slate-900 text-white`}
          >
            {t("landing.ctaPrimary")}
          </Link>
          <Link
            href={`${base}/how-it-works`}
            className={`${btn} border border-slate-300`}
          >
            {t("landing.ctaSecondary")}
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">{t("landing.whyTitle")}</h2>
        <p className="max-w-3xl text-slate-700">{t("landing.why")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">{t("landing.minTitle")}</h2>
        <p className="max-w-3xl text-slate-700">{t("landing.min")}</p>
        <p className="max-w-3xl italic text-slate-700">
          {t("landing.minNote")}
        </p>
        <Link href={`${base}/legal-basis`} className="underline">
          {t("nav.legalBasis")} →
        </Link>
      </section>

      <section className="space-y-3">
        <p className="text-lg font-medium">
          {t("landing.pricingCta")}{" "}
          <Link href={`${base}/pricing`} className="underline">
            {t("landing.pricingLink")}
          </Link>
        </p>
        {!enabled && <Waitlist t={t} country={country} />}
      </section>
    </div>
  );
}
