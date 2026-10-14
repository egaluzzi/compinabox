import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CountryPicker } from "@/components/CountryPicker";
import { JsonLd } from "@/components/JsonLd";
import { Waitlist } from "@/components/Waitlist";
import { FaqList } from "@/components/FaqList";
import { getT, localeFromCookies } from "@/lib/i18n";
import {
  alternatesFor,
  faqJsonLd,
  organizationJsonLd,
  pageMetadata,
} from "@/lib/seo";
import { sharedFaq } from "@/lib/faq";

export async function generateMetadata(): Promise<Metadata> {
  const jar = await cookies();
  const t = getT(localeFromCookies((n) => jar.get(n)?.value));
  return pageMetadata({
    title: t("meta.home.title"),
    description: t("meta.home.description"),
    canonical: "/",
    languages: alternatesFor("", { includeEn: true }),
  });
}

export default async function Home() {
  const jar = await cookies();
  const t = getT(localeFromCookies((n) => jar.get(n)?.value));
  const faq = sharedFaq(t);
  const bold = { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> };

  return (
    <div className="space-y-12">
      <JsonLd
        data={organizationJsonLd(t("brand.name"), t("meta.home.description"))}
      />
      <JsonLd data={faqJsonLd(faq)} />

      <section className="space-y-4">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {t("home.hero")}
        </h1>
        <p className="max-w-3xl text-lg text-slate-700">{t("home.sub")}</p>
        <div className="space-y-3 pt-2">
          <p className="font-semibold">{t("home.cta")}</p>
          <CountryPicker
            labels={{
              ar: t("home.argentina"),
              br: t("home.brazil"),
              mx: t("home.mexico"),
              other: t("home.other"),
            }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">{t("home.whyTitle")}</h2>
        <p className="max-w-3xl text-slate-700">{t.rich("home.why", bold)}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">{t("home.getTitle")}</h2>
        <ol className="list-decimal space-y-2 pl-6 text-slate-700">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => (
            <li key={n}>{t(`home.item${n}`)}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <p className="max-w-3xl text-slate-700">{t("home.availability")}</p>
        <Waitlist t={t} country={null} />
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">{t("faq.title")}</h2>
        <FaqList items={faq} />
      </section>
    </div>
  );
}
