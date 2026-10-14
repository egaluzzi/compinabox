import type { Metadata } from "next";
import {
  countryMetadata,
  loadCountry,
  type CountryParams,
} from "@/lib/country-page";

export function generateMetadata({ params }: CountryParams): Promise<Metadata> {
  return countryMetadata(params, {
    suffix: "/how-it-works",
    title: (t) => `${t("howItWorks.title")} | ${t("brand.name")}`,
  });
}

export default async function HowItWorks({ params }: CountryParams) {
  const { t } = await loadCountry(params);
  const steps = [
    { title: t("howItWorks.s1t"), body: null },
    { title: t("howItWorks.s2t"), body: t("howItWorks.s2b") },
    { title: t("howItWorks.s3t"), body: t("howItWorks.s3b") },
    { title: t("howItWorks.s4t"), body: t("howItWorks.s4b") },
    { title: t("howItWorks.s5t"), body: t("howItWorks.s5b") },
  ];
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">{t("howItWorks.title")}</h1>
      <ol className="list-decimal space-y-4 pl-6">
        {steps.map(({ title, body }) => (
          <li key={title}>
            <strong>{title}</strong>
            {body && <> {body}</>}
          </li>
        ))}
      </ol>
    </div>
  );
}
