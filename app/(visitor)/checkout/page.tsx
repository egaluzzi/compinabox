import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CheckoutForm } from "@/components/CheckoutForm";
import { isCountry, isCountryEnabled } from "@/lib/countries";
import { COUNTRY_LOCALE, getT, localeFromCookies } from "@/lib/i18n";
import { resolveProvider } from "@/lib/payments";
import { formatPrice, PRICING } from "@/lib/pricing";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

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

function providerAvailable(): boolean {
  try {
    return resolveProvider().available;
  } catch (err) {
    console.error(err); // e.g. mercadopago before phase 9b
    return false;
  }
}

// /checkout?c=br — language follows the country in the query, else the cookies.
export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const jar = await cookies();
  const country = isCountry(c) ? c : null;
  const t = getT(
    country
      ? COUNTRY_LOCALE[country]
      : localeFromCookies((n) => jar.get(n)?.value),
  );

  const heading = <h1 className="text-3xl font-bold">{t("checkout.title")}</h1>;
  if (!country || !isCountryEnabled(country))
    return (
      <div className="space-y-3">
        {heading}
        <p className="text-slate-700">{t("checkout.errCountry")}</p>
      </div>
    );
  if (!providerAvailable())
    return (
      <div className="space-y-3">
        {heading}
        <p className="text-slate-700">{t("checkout.unavailable")}</p>
      </div>
    );

  const price = PRICING[country];
  return (
    <div className="space-y-5">
      {heading}
      <p className="text-lg">
        {t("checkout.price")}:{" "}
        <strong>{formatPrice(price, COUNTRY_LOCALE[country])}</strong>
        {price.isPlaceholder && (
          <span className="ml-3 rounded bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
            {t("checkout.testPrice")}
          </span>
        )}
      </p>
      <CheckoutForm
        country={country}
        labels={{
          companyName: t("checkout.companyName"),
          taxId: country === "br" ? t("checkout.taxIdBr") : t("checkout.taxId"),
          billingEmail: t("checkout.billingEmail"),
          button: t("checkout.button"),
          processing: t("checkout.processing"),
          signIn: t("checkout.signInLink"),
          errors: {
            invalid_name: t("checkout.errInvalidName"),
            invalid_tax_id: t("checkout.errInvalidTaxId"),
            invalid_email: t("checkout.errInvalidEmail"),
            email_in_use: t("checkout.errEmailInUse"),
            country_unavailable: t("checkout.errCountry"),
            unavailable: t("checkout.unavailable"),
            generic: t("checkout.errGeneric"),
          },
        }}
      />
    </div>
  );
}
