import { getLegalContent, isNotYetEnabled } from "@/lib/content";
import { getMessages } from "@/lib/i18n";
import { DocumentGenerationError } from "./errors";
import { interpolate, type MergeValues } from "./merge";
import { TEMPLATES } from "./templates";
import type {
  GenerateInput,
  LegalReference,
  Section,
  StructuredDocument,
} from "./types";

const COUNTRY_LABEL = { br: "Brasil", ar: "Argentina", mx: "México" } as const;

/**
 * Pure and deterministic: the same input always yields the same StructuredDocument
 * (no clock, no randomness), so "unchanged inputs" can be detected by comparing content.
 */
export function generateDocument(input: GenerateInput): StructuredDocument {
  const { type, locale, country, company } = input;
  const legal = getLegalContent(country);
  if (isNotYetEnabled(legal))
    throw new DocumentGenerationError(
      "not_yet_enabled",
      `Legal content for ${country} is not enabled yet`,
      country,
    );
  const templates = TEMPLATES[locale];
  if (!templates)
    throw new DocumentGenerationError(
      "unsupported_locale",
      `No templates for locale ${locale}`,
    );
  const template = templates[type];
  if (!template)
    throw new DocumentGenerationError(
      "no_template",
      `No template for ${type} in ${locale}`,
    );
  if (legal.locale !== locale)
    throw new DocumentGenerationError(
      "unsupported_locale",
      `Legal content for ${country} is ${legal.locale}, not ${locale}`,
      country,
    );

  const industryLabel = getMessages(locale).industry[company.industry];
  const values: MergeValues = {
    companyName: company.name.trim(),
    industry: industryLabel,
    country: COUNTRY_LABEL[country],
  };
  const fill = (s: string) => interpolate(s, values);

  const sections: Section[] = [];
  for (const s of template.sections) {
    if ("paragraphs" in s) {
      sections.push({
        id: s.id,
        heading: fill(s.heading),
        paragraphs: s.paragraphs.map(fill),
      });
    } else if (s.slot === "legalContext") {
      // Citations come only from the country's legal content, never from a template.
      const laws = new Intl.ListFormat(locale, {
        style: "long",
        type: "conjunction",
      }).format(legal.laws.map((l) => l.citation));
      sections.push({
        id: s.id,
        heading: fill(s.heading),
        paragraphs: [
          interpolate(s.intro, { ...values, laws }),
          legal.explainer,
          ...s.closing.map(fill),
          legal.disclaimer,
        ],
      });
    } else {
      const notes = template.industryNotes?.[company.industry];
      if (notes?.length)
        sections.push({
          id: s.id,
          heading: fill(s.heading),
          paragraphs: notes.map(fill),
        });
    }
  }

  const legalReferences: LegalReference[] = legal.laws.map((l) => ({ ...l }));
  return {
    templateVersion: template.version,
    locale,
    type,
    title: fill(template.title),
    sections,
    legalReferences,
    mergeSnapshot: {
      companyName: values.companyName,
      industry: industryLabel,
      country: values.country,
    },
    reviewStatus: legal.reviewStatus,
  };
}

/** Canonical serialisation: key order is fixed by construction above. */
export const serializeDocument = (d: StructuredDocument) => JSON.stringify(d);
export const parseDocument = (s: string) => JSON.parse(s) as StructuredDocument;
