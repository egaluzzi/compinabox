export type PaymentStatus =
  "paid" | "pending" | "failed" | "expired" | "refunded" | "charged_back";

/** What a provider needs to start a hosted checkout. */
export type AttemptForCheckout = {
  id: string;
  amountCents: number;
  currency: string;
  companyName: string;
  billingEmail: string;
  country: string;
};

/** A webhook is only a prompt: which payment to re-fetch from the processor. */
export type WebhookEvent = { eventId: string; paymentRef: string };

/**
 * Result of verifying a webhook: a prompt to act on, `{ ignored: true }` (authentic but not a
 * payment notification: acknowledge with 200, do nothing), or null (not authentic: 401).
 */
export type WebhookVerification = WebhookEvent | { ignored: true } | null;

/** What the *processor* says about a payment (never what the browser or webhook claims). */
export type PaymentInfo = {
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  attemptId: string;
  /**
   * Ledger discriminator appended to the event key (`<provider>:<eventId>:<ledgerStatus>`), so a
   * paid and a refunded notification for the same payment are different events. Unset = key is
   * `<provider>:<eventId>` (the fake provider, whose event ids are already unique).
   */
  ledgerStatus?: string;
  /** Cents already refunded on a payment that is still `paid` (a partial refund). */
  refundedCents?: number;
};

/** The processor could not vouch for the reference (unknown / tampered). Nothing may be provisioned. */
export class PaymentNotFound extends Error {
  constructor(message = "payment not found") {
    super(message);
    this.name = "PaymentNotFound";
  }
}

/** The processor could not be reached; the webhook should be retried later. */
export class PaymentLookupUnavailable extends Error {
  constructor(message = "payment lookup unavailable") {
    super(message);
    this.name = "PaymentLookupUnavailable";
  }
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(
    attempt: AttemptForCheckout,
  ): Promise<{ redirectUrl: string; providerRef: string }>;
  /** Returns the event if the signature is valid, else null. `url` is the request URL (MP signs `data.id` from its query). */
  verifyWebhook(
    rawBody: string,
    headers: Headers,
    url: string,
  ): WebhookVerification | Promise<WebhookVerification>;
  /** Throws PaymentNotFound / PaymentLookupUnavailable. */
  fetchPayment(paymentRef: string): Promise<PaymentInfo>;
  /**
   * Reconciliation: payment refs the processor holds for an attempt, oldest first (empty = none).
   * Throws PaymentLookupUnavailable. Absent on providers with nothing to reconcile (fake).
   */
  findPayments?(attemptId: string): Promise<string[]>;
}
