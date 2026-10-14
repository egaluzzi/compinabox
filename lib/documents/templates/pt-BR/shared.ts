import type { TemplateSection } from "../../types";

/** Filled by the engine from the country's legal content (lib/content); no citation text lives here. */
export const legalContext: TemplateSection = {
  id: "legal-context",
  heading: "Contexto legal",
  slot: "legalContext",
  intro: "A legislação aplicável inclui {{laws}}.",
  closing: [
    "Este documento descreve compromissos e regras internas de {{companyName}}. Ele não garante, por si só, o cumprimento de qualquer lei e não substitui a análise de um advogado.",
  ],
};

export const industryNotesSection: TemplateSection = {
  id: "industry-notes",
  heading: "Pontos de atenção no setor: {{industry}}",
  slot: "industryNotes",
};

export const RESPONSIBLE =
  "o responsável pelo programa de integridade designado pela Administração";
export const DO_RESPONSIBLE = RESPONSIBLE.replace(/^o /, "do ");
export const AO_RESPONSIBLE = RESPONSIBLE.replace(/^o /, "ao ");
export const PELO_RESPONSIBLE = RESPONSIBLE.replace(/^o /, "pelo ");
export const Responsible =
  RESPONSIBLE.charAt(0).toUpperCase() + RESPONSIBLE.slice(1);
