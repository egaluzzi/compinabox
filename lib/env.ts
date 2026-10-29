// The deployment environment and the one guard that keeps staging conveniences out of production
// (CLAUDE.md §8, §9). Pure functions of an env object so every rule is unit-tested.
//
// APP_ENV = development (default when unset) | staging | production.
// An unknown value is itself a violation and is checked as production would be: a typo must not
// switch the safeguards off.

export const APP_ENVS = ["development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

type Env = Record<string, string | undefined>;

/** The effective environment. Unknown values are treated as `production` (see above). */
export function appEnv(env: Env = process.env): AppEnv {
  const raw = (env.APP_ENV ?? "").trim().toLowerCase();
  if (raw === "") return "development";
  return (APP_ENVS as readonly string[]).includes(raw)
    ? (raw as AppEnv)
    : "production";
}

export const isStaging = (env: Env = process.env) => appEnv(env) === "staging";

/** True when APP_ENV is set to something that is not one of the three names. */
export function isInvalidAppEnv(env: Env = process.env): boolean {
  const raw = (env.APP_ENV ?? "").trim().toLowerCase();
  return raw !== "" && !(APP_ENVS as readonly string[]).includes(raw);
}

const OFF = new Set(["", "false", "0", "no", "off"]);
/** "Switched on" = anything but unset / empty / false / 0 / no / off. */
const isOn = (v: string | undefined) =>
  !OFF.has((v ?? "").trim().toLowerCase());

const REQUIRED_IN_PRODUCTION = [
  "AUTH_SECRET",
  "REPORT_ENCRYPTION_KEYS",
  "APP_URL",
  "AUTH_URL",
  "DATABASE_URL",
] as const;

const isPlaceholder = (v: string) => /changeme/i.test(v);

/**
 * Violations as fixed codes (never values, so the list is safe in a health response and in logs).
 * Empty list = nothing wrong. Only `production` (or an unknown APP_ENV) has rules.
 */
export function checkEnvironment(env: Env = process.env): string[] {
  const out: string[] = [];
  if (isInvalidAppEnv(env)) out.push("app_env_invalid");
  if (appEnv(env) !== "production") return out;

  if (isOn(env.ALLOW_FAKE_PAYMENTS)) out.push("allow_fake_payments_set");
  if ((env.PAYMENT_PROVIDER ?? "").trim().toLowerCase() === "fake") {
    out.push("payment_provider_fake");
  }
  if ((env.PAYMENT_PROVIDER ?? "").trim().toLowerCase() === "mercadopago") {
    for (const name of [
      "MERCADOPAGO_ACCESS_TOKEN",
      "MERCADOPAGO_WEBHOOK_SECRET",
    ] as const) {
      const v = (env[name] ?? "").trim();
      if (v === "") out.push(`${name.toLowerCase()}_missing`);
      else if (isPlaceholder(v)) out.push(`${name.toLowerCase()}_placeholder`);
    }
  }
  if (isOn(env.EMAIL_DEV_SINK)) out.push("email_dev_sink_set");
  for (const name of REQUIRED_IN_PRODUCTION) {
    const v = (env[name] ?? "").trim();
    if (v === "") out.push(`${name.toLowerCase()}_missing`);
    else if (isPlaceholder(v)) out.push(`${name.toLowerCase()}_placeholder`);
  }
  for (const name of ["APP_URL", "AUTH_URL"] as const) {
    const v = (env[name] ?? "").trim();
    if (v !== "" && !/^https:\/\//i.test(v)) {
      out.push(`${name.toLowerCase()}_not_https`);
    }
  }
  return out;
}

/** Banner text per locale; the same string on every page type. */
export const STAGING_BANNER: Record<string, string> = {
  en: "Test environment — fictitious data",
  "es-AR": "Ambiente de prueba — datos ficticios",
  "es-MX": "Ambiente de pruebas — datos ficticios",
  "pt-BR": "Ambiente de teste — dados fictícios",
};

export function stagingBannerText(lang: string): string {
  return STAGING_BANNER[lang] ?? STAGING_BANNER["pt-BR"];
}
