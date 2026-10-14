import type { Locale } from "@/lib/i18n";

export const DISPLAY_TZ = "America/Sao_Paulo";

export function formatDate(date: Date, locale: Locale) {
  return date.toLocaleDateString(locale, { timeZone: DISPLAY_TZ });
}

/** Amounts are stored in cents with their own currency; shown in the company's locale. */
export function formatMoney(
  amountCents: number,
  currency: string,
  locale: Locale,
) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amountCents / 100,
  );
}
