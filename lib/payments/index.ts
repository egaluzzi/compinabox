import { createFakeProvider } from "./fake";
import type { PaymentProvider } from "./types";

export type ProviderResolution =
  { available: true; provider: PaymentProvider } | { available: false };

/**
 * Picks the provider from PAYMENT_PROVIDER (none | fake | mercadopago); read at request time.
 *
 * GUARDRAIL (CLAUDE.md §8): `fake` provisions accounts without payment. It works only with
 * ALLOW_FAKE_PAYMENTS=true AND FAKE_PAYMENTS_SECRET set; otherwise payments are unavailable and
 * every fake route 404s.
 */
export function resolveProvider(
  env: NodeJS.ProcessEnv = process.env,
): ProviderResolution {
  const name = (env.PAYMENT_PROVIDER ?? "none").trim().toLowerCase();
  if (name === "fake") {
    const secret = env.FAKE_PAYMENTS_SECRET;
    if (env.ALLOW_FAKE_PAYMENTS !== "true" || !secret) {
      return { available: false };
    }
    return {
      available: true,
      provider: createFakeProvider({
        secret,
        appUrl: env.APP_URL || "http://localhost:3000",
      }),
    };
  }
  if (name === "mercadopago") {
    throw new Error(
      "PAYMENT_PROVIDER=mercadopago: not implemented until phase 9b",
    );
  }
  return { available: false };
}

/** The fake secret, only when the fake provider is fully enabled (simulator routes use this). */
export function fakeSecretIfEnabled(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const r = resolveProvider(env);
  return r.available && r.provider.name === "fake"
    ? (env.FAKE_PAYMENTS_SECRET as string)
    : null;
}
