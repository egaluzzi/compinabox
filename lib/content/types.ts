import type { Country } from "@/lib/countries";
import type { Locale } from "@/lib/i18n";

/**
 * Structured legal-basis data per country (SPEC §7). Edited only in a phase scoped for it and
 * only from SPEC.md / CONTENT.md until a lawyer has reviewed it (CLAUDE.md §8).
 */
export type LegalLaw = {
  id: string;
  shortName: string;
  officialName: string;
  citation: string;
  summary: string;
};

export type LegalElement = { id: string; text: string };

export type ReviewStatus = "draft" | { reviewer: string; date: string };

export type CountryLegalContent = {
  country: Country;
  locale: Locale;
  laws: LegalLaw[];
  requiredElements: LegalElement[];
  recommendedElements: LegalElement[];
  explainer: string;
  disclaimer: string;
  reviewStatus: ReviewStatus;
};

/** Placeholder exported by countries whose legal content is built in a later phase. */
export type NotYetEnabled = {
  country: Country;
  notYetEnabled: true;
};

export const isNotYetEnabled = (
  v: CountryLegalContent | NotYetEnabled,
): v is NotYetEnabled => "notYetEnabled" in v;
