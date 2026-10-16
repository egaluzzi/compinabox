import { and, eq } from "drizzle-orm";
import { createWelcomeToken } from "@/lib/auth/links";
import type { Db } from "@/lib/db/client";
import {
  billingRecords,
  checkoutAttempt,
  companies,
  paymentEvent,
  users,
} from "@/lib/db/schema";
import { getEmailSender } from "@/lib/email";
import { linkEmail } from "@/lib/email/templates";
import { COUNTRY_LOCALE } from "@/lib/i18n";
import { uniqueCompanySlug } from "@/lib/whistleblower/company-slug";
import type { Country } from "@/lib/countries";
import {
  PaymentLookupUnavailable,
  PaymentNotFound,
  type PaymentInfo,
  type PaymentProvider,
} from "./types";

export const RETURN_TOKEN_TTL_MS = 60 * 60 * 1000;

export type Outcome =
  | "provisioned"
  | "replay"
  | "already_paid"
  | "marked_failed"
  | "marked_expired"
  | "still_pending"
  | "unknown_attempt"
  | "mismatch"
  | "email_conflict";

export type WebhookResult = {
  status: number;
  body: { ok: boolean; outcome?: Outcome; error?: string };
};

type Provisioned = {
  outcome: Outcome;
  welcome?: { email: string; country: Country; token: string };
};

/**
 * The payment webhook. A webhook is a PROMPT, not truth:
 *   verify signature -> fetch the payment from the processor -> act on what the processor says.
 * The browser return URL never reaches this code path.
 */
export async function handlePaymentWebhook(
  db: Db,
  provider: PaymentProvider,
  rawBody: string,
  headers: Headers,
  now = new Date(),
): Promise<WebhookResult> {
  const event = await provider.verifyWebhook(rawBody, headers);
  if (!event)
    return { status: 401, body: { ok: false, error: "invalid_signature" } };

  let info: PaymentInfo;
  try {
    info = await provider.fetchPayment(event.paymentRef);
  } catch (err) {
    if (err instanceof PaymentNotFound)
      return { status: 422, body: { ok: false, error: "payment_not_found" } };
    if (err instanceof PaymentLookupUnavailable)
      return { status: 503, body: { ok: false, error: "lookup_unavailable" } };
    throw err;
  }

  const result = await db.transaction(async (tx): Promise<Provisioned> => {
    const [attempt] = await tx
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, info.attemptId))
      .for("update");
    if (!attempt) return { outcome: "unknown_attempt" };
    if (
      attempt.provider !== provider.name ||
      attempt.amountCents !== info.amountCents ||
      attempt.currency !== info.currency
    )
      return { outcome: "mismatch" };

    if (info.status === "pending") return { outcome: "still_pending" };
    if (info.status === "failed" || info.status === "expired") {
      if (attempt.status !== "pending") return { outcome: "already_paid" };
      await tx
        .update(checkoutAttempt)
        .set({ status: info.status })
        .where(eq(checkoutAttempt.id, attempt.id));
      return {
        outcome: info.status === "failed" ? "marked_failed" : "marked_expired",
      };
    }

    // paid: idempotency ledger first. A conflict means this exact event was already handled.
    const eventKey = `${provider.name}:${event.eventId}`;
    const inserted = await tx
      .insert(paymentEvent)
      .values({
        eventKey,
        provider: provider.name,
        paymentRef: event.paymentRef,
        attemptId: attempt.id,
      })
      .onConflictDoNothing()
      .returning({ id: paymentEvent.id });
    if (inserted.length === 0) return { outcome: "replay" };

    // A different event for an attempt that is already provisioned must not create a second company.
    if (attempt.status === "paid") return { outcome: "already_paid" };

    const [clash] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, attempt.billingEmail));
    if (clash) {
      console.error(
        `PAID BUT NOT PROVISIONED: attempt ${attempt.id}, billing email already has an account — manual action needed`,
      );
      await tx
        .update(checkoutAttempt)
        .set({ status: "failed", failureReason: "email_in_use_after_payment" })
        .where(eq(checkoutAttempt.id, attempt.id));
      return { outcome: "email_conflict" };
    }

    const [company] = await tx
      .insert(companies)
      .values({
        name: attempt.companyName,
        slug: await uniqueCompanySlug(tx, attempt.companyName),
        taxId: attempt.taxId,
        country: attempt.country,
      })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({
        companyId: company.id,
        role: "admin",
        email: attempt.billingEmail,
      })
      .returning();
    await tx.insert(billingRecords).values({
      companyId: company.id,
      amountCents: attempt.amountCents,
      currency: attempt.currency,
      utmSource: attempt.utmSource,
      utmMedium: attempt.utmMedium,
      utmCampaign: attempt.utmCampaign,
      paidAt: now,
    });
    await tx
      .update(checkoutAttempt)
      .set({
        status: "paid",
        paidAt: now,
        userId: user.id,
        returnTokenExpiresAt: new Date(now.getTime() + RETURN_TOKEN_TTL_MS),
      })
      .where(and(eq(checkoutAttempt.id, attempt.id)));
    const token = await createWelcomeToken(
      tx as unknown as Db,
      user.email,
      now,
    );
    return {
      outcome: "provisioned",
      welcome: {
        email: user.email,
        country: attempt.country as Country,
        token,
      },
    };
  });

  // After commit: a mail failure must not undo or retry a provisioning that already happened.
  if (result.welcome) {
    try {
      const base = new URL(process.env.APP_URL || "http://localhost:3000")
        .origin;
      const url = `${base}/api/welcome?token=${encodeURIComponent(result.welcome.token)}`;
      await getEmailSender().send(
        linkEmail(
          "welcome",
          COUNTRY_LOCALE[result.welcome.country],
          result.welcome.email,
          url,
        ),
      );
    } catch (err) {
      console.error(
        "welcome email failed (account exists; user can request a sign-in link):",
        err,
      );
    }
  }

  if (result.outcome === "unknown_attempt" || result.outcome === "mismatch")
    return { status: 422, body: { ok: false, outcome: result.outcome } };
  return { status: 200, body: { ok: true, outcome: result.outcome } };
}
