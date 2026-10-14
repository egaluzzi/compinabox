// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NotYetEnabled, normalizeCnpj, validateTaxId } from "@/lib/tax-id";

describe("CNPJ", () => {
  it("accepts valid numbers, formatted or not", () => {
    expect(normalizeCnpj("11222333000181")).toBe("11222333000181");
    expect(normalizeCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeCnpj(" 11.222.333/0001-81 ")).toBe("11222333000181");
    expect(normalizeCnpj("45.997.418/0001-53")).toBe("45997418000153");
  });
  it("rejects wrong check digits", () => {
    expect(normalizeCnpj("11222333000180")).toBeNull();
    expect(normalizeCnpj("11222333000191")).toBeNull();
    expect(normalizeCnpj("45.997.418/0001-52")).toBeNull();
  });
  it("rejects repeated digits even though their check digits 'work'", () => {
    for (let d = 0; d <= 9; d++)
      expect(normalizeCnpj(String(d).repeat(14))).toBeNull();
  });
  it("rejects wrong length and junk", () => {
    for (const bad of [
      "",
      "1122233300018",
      "112223330001811",
      "abcdefghijklmn",
      "11222333000181x",
    ])
      expect(normalizeCnpj(bad)).toBeNull();
  });
  it("validateTaxId('br') returns normalized value or ok:false", () => {
    expect(validateTaxId("br", "11.222.333/0001-81")).toEqual({
      ok: true,
      value: "11222333000181",
    });
    expect(validateTaxId("br", "1")).toEqual({ ok: false });
  });
});

describe("CUIT / RFC", () => {
  it.each(["ar", "mx"] as const)("%s throws NotYetEnabled", (c) => {
    expect(() => validateTaxId(c, "20123456786")).toThrow(NotYetEnabled);
  });
});
