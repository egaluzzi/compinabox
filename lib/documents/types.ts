import type { Country } from "@/lib/countries";
import type { ReviewStatus } from "@/lib/content";
import type { Industry } from "@/lib/industries";
import type { Locale } from "@/lib/i18n";

export const DOCUMENT_TYPES = [
  "code_of_conduct",
  "policy:anti_bribery",
  "policy:gifts_hospitality",
  "policy:conflicts_of_interest",
  "policy:third_party_public_officials",
  "policy:whistleblower_protection",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const isDocumentType = (v: unknown): v is DocumentType =>
  typeof v === "string" && (DOCUMENT_TYPES as readonly string[]).includes(v);

export type Section = { id: string; heading: string; paragraphs: string[] };

export type LegalReference = {
  id: string;
  shortName: string;
  officialName: string;
  citation: string;
  summary: string;
};

/** What is stored (as JSON text) in documents.content. Deterministic: no timestamps, no randomness. */
export type StructuredDocument = {
  templateVersion: number;
  locale: Locale;
  type: DocumentType;
  title: string;
  sections: Section[];
  /** Snapshot of the legal references used; a later br.ts correction affects only the next regeneration. */
  legalReferences: LegalReference[];
  mergeSnapshot: { companyName: string; industry: string; country: string };
  /** Snapshot of the review state of the templates + legal content this was generated from. */
  reviewStatus: ReviewStatus;
};

export type GenerateInput = {
  type: DocumentType;
  locale: Locale;
  country: Country;
  company: { name: string; industry: Industry };
};

/** A template section: plain text with {{merge}} fields, or a slot the engine fills. */
export type TemplateSection =
  | { id: string; heading: string; paragraphs: string[] }
  | {
      id: string;
      heading: string;
      slot: "legalContext";
      /** May use {{laws}} (the citations from the country's legal content, joined for the locale). */
      intro: string;
      closing: string[];
    }
  | { id: string; heading: string; slot: "industryNotes" };

export type DocumentTemplate = {
  type: DocumentType;
  /** Bump when the template text changes; stored with every generated document. */
  version: number;
  title: string;
  sections: TemplateSection[];
  /** Optional per-industry notes (industries without an entry get no extra section). */
  industryNotes?: Partial<Record<Industry, string[]>>;
};
