import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { isCountry, isCountryEnabled } from "@/lib/countries";
import type { Db } from "@/lib/db/client";
import { checkoutAttempt, users } from "@/lib/db/schema";
import { appEnv } from "@/lib/env";
import { TERMS_VERSION } from "@/lib/legal/version";
import type { PaymentProvider } from "@/lib/payments/types";
import { PRICING } from "@/lib/pricing";
import { NotYetEnabled, validateTaxId } from "@/lib/tax-id";
import { hasUtm, type Utm } from "@/lib/utm";

export const hashToken = (t: string) =>
  createHash("sha256").update(t).digest("hex");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AttemptError =
  | "country_unavailable"
  | "invalid_name"
  | "invalid_tax_id"
  | "invalid_email"
  | "terms_not_accepted"
  | "email_in_use"
  | "unavailable"
  | "provider_error";

export type CreateAttemptResult =
  | { ok: true; attemptId: string; redirectUrl: string; returnToken: string }
  | { ok: false; error: AttemptError };

export type AttemptInput = {
  country: unknown;
  companyName: unknown;
  taxId: unknown;
  billingEmail: unknown;
  /** The checkbox, and the text version the form was rendered with. Both required. */
  termsAccepted?: unknown;
  termsVersion?: unknown;
  utm: Utm | null;
};

/**
 * Validates, stores a `checkout_attempt`, asks the provider for a hosted-checkout URL.
 * Creating an attempt provisions nothing — only a processor-confirmed payment does.
 */
export async function createAttempt(
  db: Db,
  provider: PaymentProvider,
  input: AttemptInput,
): Promise<CreateAttemptResult> {
  const country = input.country;
  if (!isCountry(country) || !isCountryEnabled(country))
    return { ok: false, error: "country_unavailable" };

  const price = PRICING[country];
  // No real price exists yet: the fake provider may "charge" the placeholder anywhere it is allowed,
  // Mercado Pago only outside production (sandbox credentials on staging: that is how it is tested).
  if (
    price.isPlaceholder &&
    provider.name !== "fake" &&
    !(provider.name === "mercadopago" && appEnv() !== "production")
  )
    return { ok: false, error: "unavailable" };

  const companyName =
    typeof input.companyName === "string" ? input.companyName.trim() : "";
  if (companyName.length < 2 || companyName.length > 120)
    return { ok: false, error: "invalid_name" };

  let taxId: string;
  try {
    const r = validateTaxId(
      country,
      typeof input.taxId === "string" ? input.taxId : "",
    );
    if (!r.ok) return { ok: false, error: "invalid_tax_id" };
    taxId = r.value;
  } catch (e) {
    if (e instanceof NotYetEnabled)
      return { ok: false, error: "country_unavailable" };
    throw e;
  }

  const email =
    typeof input.billingEmail === "string"
      ? input.billingEmail.trim().toLowerCase()
      : "";
  if (email.length > 254 || !EMAIL.test(email))
    return { ok: false, error: "invalid_email" };

  // The terms checkbox: ticked, for the version currently in force (a form rendered before a text
  // change is refused, so the stored version is always the one the buyer saw).
  if (input.termsAccepted !== true || input.termsVersion !== TERMS_VERSION)
    return { ok: false, error: "terms_not_accepted" };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (existing) return { ok: false, error: "email_in_use" };

  const returnToken = randomBytes(32).toString("base64url");
  const utm = input.utm && hasUtm(input.utm) ? input.utm : null;
  const [attempt] = await db
    .insert(checkoutAttempt)
    .values({
      provider: provider.name,
      country,
      companyName,
      taxId,
      billingEmail: email,
      amountCents: price.amountCents,
      currency: price.currency,
      utmSource: utm?.source ?? null,
      utmMedium: utm?.medium ?? null,
      utmCampaign: utm?.campaign ?? null,
      returnTokenHash: hashToken(returnToken),
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
    })
    .returning();

  try {
    const { redirectUrl, providerRef } = await provider.createCheckout({
      id: attempt.id,
      amountCents: attempt.amountCents,
      currency: attempt.currency,
      companyName,
      billingEmail: email,
      country,
    });
    await db
      .update(checkoutAttempt)
      .set({ providerRef })
      .where(eq(checkoutAttempt.id, attempt.id));
    return { ok: true, attemptId: attempt.id, redirectUrl, returnToken };
  } catch (err) {
    console.error("createCheckout failed:", err);
    await db
      .update(checkoutAttempt)
      .set({ status: "failed", failureReason: "provider_error" })
      .where(eq(checkoutAttempt.id, attempt.id));
    return { ok: false, error: "provider_error" };
  }
}
