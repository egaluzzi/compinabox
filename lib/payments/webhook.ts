import { and, eq, isNull } from "drizzle-orm";
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
import { sendOpsAlert } from "./alerts";
import {
  PaymentLookupUnavailable,
  PaymentNotFound,
  type PaymentInfo,
  type PaymentProvider,
  type WebhookEvent,
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
  | "email_conflict"
  | "refunded"
  | "partial_refund"
  | "refund_unprovisioned"
  | "duplicate_payment"
  | "ignored";

export type WebhookResult = {
  status: number;
  body: { ok: boolean; outcome?: Outcome; error?: string };
};

type Provisioned = {
  outcome: Outcome;
  welcome?: { email: string; country: Country; token: string };
  alert?: string;
  alertFacts?: Record<string, string | number>;
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
  url: string,
  now = new Date(),
): Promise<WebhookResult> {
  const verified = await provider.verifyWebhook(rawBody, headers, url);
  if (!verified)
    return { status: 401, body: { ok: false, error: "invalid_signature" } };
  // Authentic but not a payment notification (e.g. a merchant order): acknowledge, never retry.
  if ("ignored" in verified)
    return { status: 200, body: { ok: true, outcome: "ignored" } };
  return processPaymentEvent(db, provider, verified, now);
}

/** Re-fetch the payment from the processor, then act on it (shared by the webhook and the reconciler). */
export async function processPaymentEvent(
  db: Db,
  provider: PaymentProvider,
  event: WebhookEvent,
  now = new Date(),
): Promise<WebhookResult> {
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
  return applyPayment(db, provider, event, info, now);
}

/** The ONLY place an attempt becomes paid / failed / refunded. `info` must come from the processor. */
export async function applyPayment(
  db: Db,
  provider: PaymentProvider,
  event: WebhookEvent,
  info: PaymentInfo,
  now = new Date(),
): Promise<WebhookResult> {
  const result = await db.transaction(async (tx): Promise<Provisioned> => {
    const [attempt] = await tx
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, info.attemptId))
      .for("update");
    const facts = {
      payment: event.paymentRef,
      attempt: info.attemptId,
      amountCents: info.amountCents,
      currency: info.currency,
    };
    if (!attempt)
      return {
        outcome: "unknown_attempt",
        alert: "Payment for an unknown checkout attempt",
        alertFacts: facts,
      };
    if (
      attempt.provider !== provider.name ||
      attempt.amountCents !== info.amountCents ||
      attempt.currency !== info.currency
    )
      return {
        outcome: "mismatch",
        alert:
          "Payment does not match its checkout attempt (nothing provisioned)",
        alertFacts: { ...facts, expectedCents: attempt.amountCents },
      };

    const ledgerKey = (suffix?: string) =>
      [provider.name, event.eventId, suffix ?? info.ledgerStatus]
        .filter(Boolean)
        .join(":");
    const claim = async (key: string) =>
      (
        await tx
          .insert(paymentEvent)
          .values({
            eventKey: key,
            provider: provider.name,
            paymentRef: event.paymentRef,
            attemptId: attempt.id,
          })
          .onConflictDoNothing()
          .returning({ id: paymentEvent.id })
      ).length > 0;

    if (info.status === "refunded" || info.status === "charged_back") {
      // Full refund / chargeback. Records it; never deletes or locks anything.
      if (!(await claim(ledgerKey()))) return { outcome: "replay" };
      const what = info.status === "refunded" ? "refunded" : "charged back";
      if (attempt.status !== "paid" || !attempt.userId)
        return {
          outcome: "refund_unprovisioned",
          alert: `Payment ${what} but it never provisioned an account`,
          alertFacts: facts,
        };
      const [owner] = await tx
        .select({ companyId: users.companyId })
        .from(users)
        .where(eq(users.id, attempt.userId));
      if (owner)
        await tx
          .update(billingRecords)
          .set({ refundedAt: now })
          .where(
            and(
              eq(billingRecords.companyId, owner.companyId),
              isNull(billingRecords.refundedAt),
            ),
          );
      return {
        outcome: "refunded",
        alert: `Payment ${what} (account NOT suspended: your decision)`,
        alertFacts: facts,
      };
    }

    if (
      info.status === "paid" &&
      attempt.status === "paid" &&
      (info.refundedCents ?? 0) > 0
    ) {
      // Partial refund of a provisioned payment: alert once per refunded amount, change nothing.
      if (!(await claim(ledgerKey(`partial_refund_${info.refundedCents}`))))
        return { outcome: "replay" };
      return {
        outcome: "partial_refund",
        alert: "Payment partially refunded (nothing changed)",
        alertFacts: { ...facts, refundedCents: info.refundedCents as number },
      };
    }

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
    if (!(await claim(ledgerKey()))) return { outcome: "replay" };

    // A different event for an attempt that is already provisioned must not create a second company.
    // A second approved payment (different payment id) for an attempt that is already provisioned:
    // the buyer paid twice (retry, back button, second tab). No second company; a human must refund.
    if (attempt.status === "paid")
      return {
        outcome: "duplicate_payment",
        alert:
          "DUPLICATE PAYMENT for an already provisioned attempt: refund needed",
        alertFacts: facts,
      };

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
      return {
        outcome: "email_conflict",
        alert:
          "PAID BUT NOT PROVISIONED: billing e-mail already has an account",
        alertFacts: facts,
      };
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

  // After commit, and only for payments the processor vouched for (we never get here unverified).
  if (result.alert) await sendOpsAlert(result.alert, result.alertFacts ?? {});

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
