export const INDUSTRIES = [
  "technology",
  "manufacturing",
  "construction",
  "services",
  "retail",
  "health",
  "finance",
  "energy",
  "agribusiness",
  "other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];
export const isIndustry = (v: unknown): v is Industry =>
  typeof v === "string" && (INDUSTRIES as readonly string[]).includes(v);
