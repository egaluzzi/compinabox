import type { Country } from "@/lib/countries";

export class DocumentGenerationError extends Error {
  constructor(
    public code: "not_yet_enabled" | "unsupported_locale" | "no_template",
    message: string,
    public country?: Country,
  ) {
    super(message);
    this.name = "DocumentGenerationError";
  }
}
