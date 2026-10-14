import type { Metadata } from "next";
import { FaqList } from "@/components/FaqList";
import { JsonLd } from "@/components/JsonLd";
import {
  countryMetadata,
  loadCountry,
  type CountryParams,
} from "@/lib/country-page";
import { countryFaq } from "@/lib/faq";
import { faqJsonLd } from "@/lib/seo";

export function generateMetadata({ params }: CountryParams): Promise<Metadata> {
  return countryMetadata(params, {
    suffix: "/faq",
    title: (t) => `${t("faq.title")} | ${t("brand.name")}`,
  });
}

export default async function Faq({ params }: CountryParams) {
  const { t } = await loadCountry(params);
  const items = countryFaq(t);
  return (
    <div className="space-y-6">
      <JsonLd data={faqJsonLd(items)} />
      <h1 className="text-3xl font-bold">{t("faq.title")}</h1>
      <FaqList items={items} />
    </div>
  );
}
