export const COUNTRIES = ["ar", "br", "mx"] as const;
export type Country = (typeof COUNTRIES)[number];

export function isCountry(value: unknown): value is Country {
  return (
    typeof value === "string" &&
    (COUNTRIES as readonly string[]).includes(value)
  );
}

/**
 * Parses ENABLED_COUNTRIES (comma list). Unset or blank falls back to "br"
 * (CLAUDE.md §2). Unknown tokens are ignored; case and whitespace are
 * forgiven; duplicates collapse. A value with only unknown tokens (e.g.
 * "none") enables nothing.
 */
export function parseEnabledCountries(raw: string | undefined): Country[] {
  if (raw === undefined || raw.trim() === "") return ["br"];
  const out: Country[] = [];
  for (const token of raw.split(",")) {
    const c = token.trim().toLowerCase();
    if (isCountry(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

/** Read at request time, never baked at build (CLAUDE.md §9). */
export function getEnabledCountries(): Country[] {
  return parseEnabledCountries(process.env.ENABLED_COUNTRIES);
}

export function isCountryEnabled(country: Country): boolean {
  return getEnabledCountries().includes(country);
}
