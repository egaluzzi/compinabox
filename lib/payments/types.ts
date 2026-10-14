export type PaymentStatus = "paid" | "pending" | "failed" | "expired";

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

/** What the *processor* says about a payment (never what the browser or webhook claims). */
export type PaymentInfo = {
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  attemptId: string;
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
  /** Returns the event if the signature is valid, else null. */
  verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): WebhookEvent | null | Promise<WebhookEvent | null>;
  /** Throws PaymentNotFound / PaymentLookupUnavailable. */
  fetchPayment(paymentRef: string): Promise<PaymentInfo>;
}
