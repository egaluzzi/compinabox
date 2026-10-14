// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import {
  mergeUtm,
  parseUtmCookie,
  sanitizeUtm,
  serializeUtm,
  utmFromParams,
} from "@/lib/utm";

describe("sanitizeUtm", () => {
  it("strips unsafe characters, trims and caps length", () => {
    expect(sanitizeUtm("goo<script>gle")).toBe("gooscriptgle");
    expect(sanitizeUtm("  a;b\r\nc ")).toBe("abc");
    expect(sanitizeUtm("x".repeat(500))).toHaveLength(100);
    expect(sanitizeUtm("")).toBeNull();
    expect(sanitizeUtm("<>;")).toBeNull();
    expect(sanitizeUtm(null)).toBeNull();
  });
});

describe("mergeUtm: last non-empty touch wins", () => {
  const a = { source: "g", medium: "cpc", campaign: "x" };
  it("a new touch replaces the stored one", () => {
    expect(mergeUtm(a, { source: "fb", medium: null, campaign: null })).toEqual(
      { source: "fb", medium: null, campaign: null },
    );
  });
  it("an empty touch keeps the stored one", () => {
    expect(mergeUtm(a, { source: null, medium: null, campaign: null })).toEqual(
      a,
    );
  });
});

describe("cookie round trip", () => {
  it("serialize/parse", () => {
    const u = { source: "g", medium: null, campaign: "spring sale" };
    expect(parseUtmCookie(serializeUtm(u))).toEqual(u);
  });
  it("tampered cookies are re-sanitized or ignored", () => {
    expect(parseUtmCookie("not json")).toBeNull();
    expect(parseUtmCookie(JSON.stringify({ source: "<b>x</b>" }))?.source).toBe(
      "bxb",
    );
  });
});

const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers });
const setCookie = (res: Response) => res.headers.get("set-cookie") ?? "";

describe("proxy UTM capture", () => {
  it("sets nothing without consent", () => {
    expect(setCookie(proxy(req("/br?utm_source=google")))).not.toContain(
      "utm=",
    );
    expect(
      setCookie(
        proxy(req("/br?utm_source=google", { cookie: "consent=rejected" })),
      ),
    ).not.toContain("utm=");
  });
  it("sets a 30-day cookie with consent, on marketing pages", () => {
    const sc = setCookie(
      proxy(
        req("/br/pricing?utm_source=google&utm_medium=cpc&utm_campaign=a", {
          cookie: "consent=accepted",
        }),
      ),
    );
    expect(sc).toContain("utm=");
    expect(sc).toContain("Max-Age=2592000");
    expect(decodeURIComponent(sc.split("utm=")[1].split(";")[0])).toContain(
      '"source":"google"',
    );
  });
  it("also sets it on the geo redirect from / (the query is dropped by the redirect)", () => {
    const res = proxy(
      req("/?utm_source=ads", {
        cookie: "consent=accepted",
        "cf-ipcountry": "BR",
      }),
    );
    expect(res.status).toBe(307);
    expect(setCookie(res)).toContain("utm=");
  });
  it("sanitizes values and caps their length", () => {
    const sc = setCookie(
      proxy(
        req(`/br?utm_source=${"a".repeat(400)}%3Cscript%3E`, {
          cookie: "consent=accepted",
        }),
      ),
    );
    const v = JSON.parse(decodeURIComponent(sc.split("utm=")[1].split(";")[0]));
    expect(v.source.length).toBeLessThanOrEqual(100);
    expect(v.source).not.toContain("<");
  });
  it("last non-empty touch wins; an empty touch leaves the cookie alone", () => {
    const first = serializeUtm({ source: "g", medium: null, campaign: null });
    const next = setCookie(
      proxy(
        req("/br?utm_source=fb", {
          cookie: `consent=accepted; utm=${encodeURIComponent(first)}`,
        }),
      ),
    );
    expect(decodeURIComponent(next.split("utm=")[1].split(";")[0])).toContain(
      '"source":"fb"',
    );
    expect(
      setCookie(
        proxy(
          req("/br", {
            cookie: `consent=accepted; utm=${encodeURIComponent(first)}`,
          }),
        ),
      ),
    ).not.toContain("utm=");
  });
  it("does not change geo behaviour on marketing pages", () => {
    const res = proxy(
      req("/br?utm_source=x", {
        cookie: "consent=accepted",
        "cf-ipcountry": "AR",
      }),
    );
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("utmFromParams", () => {
  it("reads the three params", () => {
    expect(
      utmFromParams(
        new URLSearchParams(
          "utm_source=a&utm_medium=b&utm_campaign=c&utm_term=zzz",
        ),
      ),
    ).toEqual({ source: "a", medium: "b", campaign: "c" });
  });
});
