import Link from "next/link";
import type { ReactNode } from "react";
import { ChangeCountry } from "./ChangeCountry";
import { ConsentBanner } from "./ConsentBanner";
import { CookieSettings } from "./CookieSettings";
import { Tracking } from "./Tracking";
import { LanguageToggle } from "./LanguageToggle";
import { blogAvailable } from "@/lib/blog";
import type { Country } from "@/lib/countries";
import { getT, type Lang, type Locale } from "@/lib/i18n";
import { resolveGtmId } from "@/lib/tracking";

type Props = {
  locale: Locale;
  /** Set on /{country}/* pages; omitted on `/`, `/legal/*`, `/checkout`. */
  country?: Country;
  /** Set on pages with the EN/ES/PT toggle. */
  lang?: Lang;
  children: ReactNode;
};

export function SiteShell({ locale, country, lang, children }: Props) {
  const t = getT(locale);
  const base = country ? `/${country}` : "";
  const link = "text-sm text-slate-700 hover:text-slate-900";
  return (
    <div className="flex min-h-screen flex-col text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href={country ? `/${country}` : "/"}
            className="text-lg font-semibold"
          >
            {t("brand.name")}
          </Link>
          {country && (
            <nav className="flex flex-wrap gap-x-4 gap-y-1">
              <Link className={link} href={`${base}/how-it-works`}>
                {t("howItWorks.title")}
              </Link>
              <Link className={link} href={`${base}/pricing`}>
                {t("nav.pricing")}
              </Link>
              <Link className={link} href={`${base}/faq`}>
                {t("faq.title")}
              </Link>
              <Link className={link} href={`${base}/legal-basis`}>
                {t("nav.legalBasis")}
              </Link>
              {blogAvailable(country) && (
                <Link className={link} href={`${base}/blog`}>
                  {t("nav.blog")}
                </Link>
              )}
            </nav>
          )}
          <div className="flex items-center gap-4">
            {lang && (
              <LanguageToggle current={lang} label={t("common.language")} />
            )}
            {country && <ChangeCountry label={t("common.changeCountry")} />}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-6 pb-24 text-sm text-slate-600">
          <p>{t("footer.disclaimer")}</p>
          <p className="flex flex-wrap gap-x-4">
            {!country && blogAvailable("generic") && (
              <Link href="/blog">{t("nav.blog")}</Link>
            )}
            <Link href="/legal/terms">{t("footer.terms")}</Link>
            <Link href="/legal/privacy">{t("footer.privacy")}</Link>
            <Link href="/legal/disclaimer">{t("footer.disclaimerLink")}</Link>
            <CookieSettings label={t("footer.cookies")} />
          </p>
        </div>
      </footer>
      <Tracking gtmId={resolveGtmId()} />
      <ConsentBanner
        text={t("consent.text")}
        accept={t("consent.accept")}
        reject={t("consent.reject")}
      />
    </div>
  );
}

export function langOf(locale: Locale): Lang {
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("pt")) return "pt";
  return "en";
}
