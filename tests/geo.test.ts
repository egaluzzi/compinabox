import { describe, expect, it } from "vitest";
import { resolveGeoRedirect } from "@/lib/geo";

const at = (over: Partial<Parameters<typeof resolveGeoRedirect>[0]>) =>
  resolveGeoRedirect({
    pathname: "/",
    countryCookie: undefined,
    cfCountry: undefined,
    ...over,
  });

describe("resolveGeoRedirect", () => {
  it.each([
    ["BR", "br"],
    ["AR", "ar"],
    ["MX", "mx"],
  ])("header %s redirects to /%s", (header, expected) => {
    expect(at({ cfCountry: header })).toBe(expected);
  });

  it("does not redirect other countries", () =>
    expect(at({ cfCountry: "DE" })).toBeNull());
  it("does not redirect when the header is absent", () => {
    expect(at({ cfCountry: undefined })).toBeNull();
    expect(at({ cfCountry: null })).toBeNull();
  });
  it.each(["XX", "T1", "", "  "])("does not redirect header %j", (h) =>
    expect(at({ cfCountry: h })).toBeNull(),
  );
  it("accepts a lowercase header", () =>
    expect(at({ cfCountry: "br" })).toBe("br"));

  it("cookie beats header: cookie country, other header", () => {
    expect(at({ countryCookie: "mx", cfCountry: "BR" })).toBe("mx");
    expect(at({ countryCookie: "ar", cfCountry: "DE" })).toBe("ar");
  });
  it("cookie beats header: cookie other, header says a market", () => {
    expect(at({ countryCookie: "other", cfCountry: "BR" })).toBeNull();
  });
  it("ignores an invalid cookie and falls back to the header", () => {
    expect(at({ countryCookie: "zz", cfCountry: "AR" })).toBe("ar");
    expect(at({ countryCookie: "BR", cfCountry: "DE" })).toBeNull(); // cookie values are lowercase only
    expect(at({ countryCookie: "", cfCountry: "MX" })).toBe("mx");
  });

  it.each([
    "/ar/pricing",
    "/br",
    "/mx/faq",
    "/pricing",
    "/legal/terms",
    "//",
    "/index",
  ])("never redirects non-root path %s", (pathname) =>
    expect(at({ pathname, cfCountry: "BR", countryCookie: "ar" })).toBeNull(),
  );
});
