import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getT, localeFromCookies } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const jar = await cookies();
  const t = getT(localeFromCookies((n) => jar.get(n)?.value));
  return pageMetadata({
    title: `${t("checkout.title")} | ${t("brand.name")}`,
    description: t("meta.home.description"),
    canonical: "/checkout",
    noindex: true,
  });
}

// Placeholder: no form, no payment code until phase 2.
export default async function Checkout() {
  const jar = await cookies();
  const t = getT(localeFromCookies((n) => jar.get(n)?.value));
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold">{t("checkout.title")}</h1>
      <p className="text-slate-700">{t("checkout.unavailable")}</p>
    </div>
  );
}
