import type { Locale } from "@/lib/i18n";
import type { DocumentTemplate, DocumentType } from "../types";
import { ptBR } from "./pt-BR";

/** Keyed by locale so es-AR / es-MX can be added without touching the engine. */
export const TEMPLATES: Partial<
  Record<Locale, Record<DocumentType, DocumentTemplate>>
> = {
  "pt-BR": ptBR,
};
