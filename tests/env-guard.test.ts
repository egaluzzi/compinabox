// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  appEnv,
  checkEnvironment,
  isInvalidAppEnv,
  isStaging,
  stagingBannerText,
} from "@/lib/env";
import { BINDER_CONCURRENCY, parseConcurrency } from "@/lib/binder/constants";

const GOOD_PROD = {
  APP_ENV: "production",
  AUTH_SECRET: "a-long-random-secret-value",
  REPORT_ENCRYPTION_KEYS: "k1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  APP_URL: "https://example.test",
  AUTH_URL: "https://example.test",
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
};

describe("appEnv", () => {
  it("defaults to development when unset or empty", () => {
    expect(appEnv({})).toBe("development");
    expect(appEnv({ APP_ENV: "  " })).toBe("development");
  });
  it("accepts the three names, case and space tolerant", () => {
    expect(appEnv({ APP_ENV: " Staging " })).toBe("staging");
    expect(appEnv({ APP_ENV: "production" })).toBe("production");
    expect(appEnv({ APP_ENV: "development" })).toBe("development");
  });
  it("treats an unknown value as production, and flags it", () => {
    expect(appEnv({ APP_ENV: "prod" })).toBe("production");
    expect(isInvalidAppEnv({ APP_ENV: "prod" })).toBe(true);
    expect(checkEnvironment({ APP_ENV: "prod" })).toContain("app_env_invalid");
  });
  it("isStaging only for staging", () => {
    expect(isStaging({ APP_ENV: "staging" })).toBe(true);
    expect(isStaging({})).toBe(false);
    expect(isStaging({ APP_ENV: "production" })).toBe(false);
  });
});

describe("checkEnvironment", () => {
  it("a complete production env has no violations", () => {
    expect(checkEnvironment(GOOD_PROD)).toEqual([]);
  });
  it("PAYMENT_PROVIDER=none is allowed in production (checkout unavailable)", () => {
    expect(
      checkEnvironment({ ...GOOD_PROD, PAYMENT_PROVIDER: "none" }),
    ).toEqual([]);
  });
  it("ALLOW_FAKE_PAYMENTS set to anything but off is a violation; 'false' is not", () => {
    expect(
      checkEnvironment({ ...GOOD_PROD, ALLOW_FAKE_PAYMENTS: "true" }),
    ).toEqual(["allow_fake_payments_set"]);
    expect(
      checkEnvironment({ ...GOOD_PROD, ALLOW_FAKE_PAYMENTS: "1" }),
    ).toEqual(["allow_fake_payments_set"]);
    expect(
      checkEnvironment({ ...GOOD_PROD, ALLOW_FAKE_PAYMENTS: "false" }),
    ).toEqual([]);
    expect(checkEnvironment({ ...GOOD_PROD, ALLOW_FAKE_PAYMENTS: "" })).toEqual(
      [],
    );
  });
  it("PAYMENT_PROVIDER=fake is a violation", () => {
    expect(
      checkEnvironment({ ...GOOD_PROD, PAYMENT_PROVIDER: "FAKE" }),
    ).toEqual(["payment_provider_fake"]);
  });
  it("EMAIL_DEV_SINK=true is a violation", () => {
    expect(checkEnvironment({ ...GOOD_PROD, EMAIL_DEV_SINK: "true" })).toEqual([
      "email_dev_sink_set",
    ]);
  });
  for (const name of [
    "AUTH_SECRET",
    "REPORT_ENCRYPTION_KEYS",
    "APP_URL",
    "AUTH_URL",
    "DATABASE_URL",
  ]) {
    it(`${name} missing or changeme is a violation`, () => {
      const missing: Record<string, string | undefined> = { ...GOOD_PROD };
      delete missing[name];
      expect(checkEnvironment(missing)).toContain(
        `${name.toLowerCase()}_missing`,
      );
      expect(checkEnvironment({ ...GOOD_PROD, [name]: "changeme" })).toContain(
        `${name.toLowerCase()}_placeholder`,
      );
      expect(checkEnvironment({ ...GOOD_PROD, [name]: "   " })).toContain(
        `${name.toLowerCase()}_missing`,
      );
    });
  }
  it("a changeme embedded in a longer value is caught", () => {
    expect(
      checkEnvironment({
        ...GOOD_PROD,
        REPORT_ENCRYPTION_KEYS: "k1:changeme-run-openssl",
      }),
    ).toEqual(["report_encryption_keys_placeholder"]);
  });
  it("APP_URL and AUTH_URL must be https", () => {
    expect(
      checkEnvironment({ ...GOOD_PROD, APP_URL: "http://example.test" }),
    ).toEqual(["app_url_not_https"]);
    expect(
      checkEnvironment({ ...GOOD_PROD, AUTH_URL: "http://example.test" }),
    ).toEqual(["auth_url_not_https"]);
  });
  it("reports every violation at once, as codes only (no values)", () => {
    const v = checkEnvironment({
      APP_ENV: "production",
      ALLOW_FAKE_PAYMENTS: "true",
      PAYMENT_PROVIDER: "fake",
      EMAIL_DEV_SINK: "true",
      AUTH_SECRET: "changeme",
    });
    expect(v).toEqual(
      expect.arrayContaining([
        "allow_fake_payments_set",
        "payment_provider_fake",
        "email_dev_sink_set",
        "auth_secret_placeholder",
        "database_url_missing",
      ]),
    );
    expect(v.join(" ")).not.toContain("changeme");
  });
  it("staging and development allow every convenience", () => {
    const loose = {
      ALLOW_FAKE_PAYMENTS: "true",
      PAYMENT_PROVIDER: "fake",
      EMAIL_DEV_SINK: "true",
      AUTH_SECRET: "changeme",
      APP_URL: "http://x",
    };
    expect(checkEnvironment({ ...loose, APP_ENV: "staging" })).toEqual([]);
    expect(checkEnvironment({ ...loose, APP_ENV: "development" })).toEqual([]);
    expect(checkEnvironment(loose)).toEqual([]);
  });
});

describe("staging banner text", () => {
  it("exists in all four locales and the default is pt-BR", () => {
    expect(stagingBannerText("pt-BR")).toBe(
      "Ambiente de teste — dados fictícios",
    );
    for (const l of ["en", "es-AR", "es-MX"])
      expect(stagingBannerText(l)).toMatch(/—/);
    expect(stagingBannerText("xx")).toBe("Ambiente de teste — dados fictícios");
  });
});

describe("BINDER_CONCURRENCY", () => {
  it("defaults to 1 and reads a sane integer from the env", () => {
    expect(parseConcurrency(undefined)).toBe(1);
    expect(parseConcurrency("")).toBe(1);
    expect(parseConcurrency("3")).toBe(3);
    expect(parseConcurrency("0")).toBe(1);
    expect(parseConcurrency("99")).toBe(1);
    expect(parseConcurrency("abc")).toBe(1);
    expect(BINDER_CONCURRENCY).toBe(1);
  });
});
