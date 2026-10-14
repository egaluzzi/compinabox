import { describe, expect, it } from "vitest";
import { parseEnabledCountries } from "@/lib/countries";

describe("parseEnabledCountries", () => {
  it("defaults to br when unset or blank", () => {
    expect(parseEnabledCountries(undefined)).toEqual(["br"]);
    expect(parseEnabledCountries("")).toEqual(["br"]);
    expect(parseEnabledCountries("   ")).toEqual(["br"]);
  });
  it("parses a comma list, forgiving case and whitespace", () => {
    expect(parseEnabledCountries("br,ar")).toEqual(["br", "ar"]);
    expect(parseEnabledCountries(" BR , Mx ")).toEqual(["br", "mx"]);
  });
  it("ignores unknown tokens and collapses duplicates", () => {
    expect(parseEnabledCountries("br,us,br,,ar")).toEqual(["br", "ar"]);
  });
  it("enables nothing when only unknown tokens are given", () => {
    expect(parseEnabledCountries("none")).toEqual([]);
  });
});
