export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDoc = {
  title: string;
  /** Short plain statement shown under the title. */
  intro: string[];
  sections: LegalSection[];
};

/**
 * A placeholder is visible bracketed text, e.g. "[CNPJ — a preencher]". The pages highlight every
 * match, and lib/legal/REVIEW.md must list each one (tests/legal.test.ts).
 */
export const PLACEHOLDER_RE =
  /\[[^\]\n]*—\s*(?:a preencher|a definir)[^\]\n]*\]/g;
