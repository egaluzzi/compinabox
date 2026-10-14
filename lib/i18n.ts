import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import esAR from "@/messages/es-AR.json";
import ptBR from "@/messages/pt-BR.json";
import esMX from "@/messages/es-MX.json";
import type { Country } from "./countries";

/** Locale codes are internal; they never appear in a URL (CLAUDE.md §5). */
export const LOCALES = ["en", "es-AR", "pt-BR", "es-MX"] as const;
export type Locale = (typeof LOCALES)[number];
export type Messages = typeof en;

const MESSAGES: Record<Locale, Messages> = {
  en,
  "es-AR": esAR,
  "pt-BR": ptBR,
  "es-MX": esMX,
};

export const COUNTRY_LOCALE: Record<Country, Locale> = {
  ar: "es-AR",
  br: "pt-BR",
  mx: "es-MX",
};

/** Generic-page language toggle (SPEC §3.4): cookie `lang` -> locale. */
export const LANG_LOCALE = { en: "en", es: "es-MX", pt: "pt-BR" } as const;
export type Lang = keyof typeof LANG_LOCALE;

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && value in LANG_LOCALE;
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

export function getT(locale: Locale) {
  return createTranslator({ locale, messages: MESSAGES[locale] });
}
export type T = ReturnType<typeof getT>;

/**
 * Locale for pages that have no country in the URL (`/`, `/legal/*`,
 * `/checkout`): the `lang` cookie, else the chosen country's language,
 * else English.
 */
export function localeFromCookies(
  get: (name: string) => string | undefined,
): Locale {
  const lang = get("lang");
  if (isLang(lang)) return LANG_LOCALE[lang];
  const country = get("country");
  if (country === "ar" || country === "br" || country === "mx")
    return COUNTRY_LOCALE[country];
  return "en";
}
