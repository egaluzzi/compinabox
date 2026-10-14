// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers });

describe("proxy", () => {
  it("redirects / with 307 and no-store", () => {
    const res = proxy(req("/", { "cf-ipcountry": "BR" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/br$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("lets the request through when there is nothing to redirect", () => {
    const res = proxy(req("/", { "cf-ipcountry": "DE" }));
    expect(res.headers.get("location")).toBeNull();
  });
  it("cookie beats header", () => {
    const res = proxy(req("/", { "cf-ipcountry": "BR", cookie: "country=mx" }));
    expect(res.headers.get("location")).toMatch(/\/mx$/);
  });
  it("is matched on / only", () => {
    expect(config.matcher).toBe("/");
  });
  it("does not redirect deep links even if it were invoked for them", () => {
    const res = proxy(req("/ar/pricing", { "cf-ipcountry": "BR" }));
    expect(res.headers.get("location")).toBeNull();
  });

  describe("redirect Location origin", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("uses APP_URL when set", () => {
      vi.stubEnv("APP_URL", "https://example.test");
      const res = proxy(req("/", { "cf-ipcountry": "BR" }));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://example.test/br");
      expect(res.headers.get("cache-control")).toBe("no-store");
    });

    it("ignores a path on APP_URL", () => {
      vi.stubEnv("APP_URL", "https://example.test/some/path");
      const res = proxy(req("/", { "cf-ipcountry": "AR" }));
      expect(res.headers.get("location")).toBe("https://example.test/ar");
    });

    it("falls back to the request URL when APP_URL is unset", () => {
      vi.stubEnv("APP_URL", "");
      const res = proxy(req("/", { "cf-ipcountry": "BR" }));
      expect(res.headers.get("location")).toBe("http://localhost:3000/br");
    });

    it("falls back to the request URL, without throwing, when APP_URL is invalid", () => {
      vi.stubEnv("APP_URL", "not a url");
      const res = proxy(req("/", { "cf-ipcountry": "BR" }));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/br");
    });
  });
});
