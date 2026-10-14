import type { Country } from "@/lib/countries";
import { ar } from "./ar";
import { br } from "./br";
import { mx } from "./mx";
import type { CountryLegalContent, NotYetEnabled } from "./types";

export * from "./types";

const CONTENT: Record<Country, CountryLegalContent | NotYetEnabled> = {
  ar,
  br,
  mx,
};

export const getLegalContent = (country: Country) => CONTENT[country];
