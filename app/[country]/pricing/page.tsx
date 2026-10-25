import type { Metadata } from "next";
import Link from "next/link";
import { TrackOnMount } from "@/components/Tracking";
import { Waitlist } from "@/components/Waitlist";
import {
  countryMetadata,
  loadCountry,
  type CountryParams,
} from "@/lib/country-page";

export function generateMetadata({ params }: CountryParams): Promise<Metadata> {
  return countryMetadata(params, {
    suffix: "/pricing",
    title: (t) => `${t("pricing.planHeader")} | ${t("brand.name")}`,
  });
}

export default async function Pricing({ params }: CountryParams) {
  const { country, t, enabled } = await loadCountry(params);
  return (
    <div className="max-w-3xl space-y-6">
      <TrackOnMount event={{ event: "view_pricing" }} />
      <h1 className="text-3xl font-bold">{t("pricing.planHeader")}</h1>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t("pricing.includedTitle")}</h2>
        <ul className="space-y-2">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => (
            <li key={n} className="flex gap-2 text-slate-700">
              <span aria-hidden="true">✓</span>
              <span>{t(`home.item${n}`)}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-slate-700">{t("pricing.tba")}</p>
      {enabled ? (
        <div className="space-y-3">
          <Link
            href={`/checkout?c=${country}`}
            className="inline-block rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
          >
            {t("checkout.button")}
          </Link>
          <p className="text-sm text-slate-600">{t("pricing.trust")}</p>
        </div>
      ) : (
        <Waitlist t={t} country={country} />
      )}
    </div>
  );
}
