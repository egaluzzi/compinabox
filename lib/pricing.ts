import type { Country } from "./countries";

export type Price = {
  amountCents: number;
  currency: string;
  /** No real price exists yet (Esteban's input, CLAUDE.md §11). While true, only the fake provider may charge it. */
  isPlaceholder: boolean;
};

// Per-country price config (SPEC §8). Placeholders: R$ 10,00 "TEST PRICE".
export const PRICING: Record<Country, Price> = {
  br: { amountCents: 1000, currency: "BRL", isPlaceholder: true },
  ar: { amountCents: 1000, currency: "ARS", isPlaceholder: true },
  mx: { amountCents: 1000, currency: "MXN", isPlaceholder: true },
};

export function formatPrice(price: Price, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: price.currency,
  }).format(price.amountCents / 100);
}
