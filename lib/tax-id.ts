import type { Country } from "./countries";

/** CUIT (ar) and RFC (mx) validation ships with their own phases (CLAUDE.md §2). */
export class NotYetEnabled extends Error {
  readonly country: Country;
  constructor(country: Country) {
    super(`Tax ID validation for "${country}" is not enabled yet`);
    this.name = "NotYetEnabled";
    this.country = country;
  }
}

function cnpjDigit(base: number[]): number {
  // weights run 2..9 right-to-left, repeating
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    sum += base[i] * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Digits-only CNPJ if the check digits are valid, else null. Accepts formatted input. */
export function normalizeCnpj(raw: string): string | null {
  const digits = raw.replace(/[.\-/\s]/g, "");
  if (!/^\d{14}$/.test(digits)) return null;
  if (/^(\d)\1{13}$/.test(digits)) return null; // 00000000000000, 11111111111111, ...
  const nums = [...digits].map(Number);
  const d1 = cnpjDigit(nums.slice(0, 12));
  const d2 = cnpjDigit([...nums.slice(0, 12), d1]);
  return nums[12] === d1 && nums[13] === d2 ? digits : null;
}

export type TaxIdResult = { ok: true; value: string } | { ok: false };

/** Throws NotYetEnabled for ar/mx. */
export function validateTaxId(country: Country, raw: string): TaxIdResult {
  if (country === "br") {
    const value = normalizeCnpj(raw);
    return value ? { ok: true, value } : { ok: false };
  }
  throw new NotYetEnabled(country);
}
