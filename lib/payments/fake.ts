import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PaymentNotFound,
  type AttemptForCheckout,
  type PaymentInfo,
  type PaymentProvider,
  type PaymentStatus,
  type WebhookEvent,
} from "./types";

// DEV/TEST ONLY. Guarded in lib/payments/index.ts (CLAUDE.md §8, §9). It plays the part of a
// processor: it signs webhooks and vouches for payments, statelessly, with FAKE_PAYMENTS_SECRET.

export const SIGNATURE_HEADER = "x-fake-signature";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * A payment ref is `<base64url(json)>.<hmac>`: attempt id, amount, currency and the status the
 * "processor" holds. fetchPayment verifies the signature, so no table is needed to remember it.
 */
export function makePaymentRef(
  secret: string,
  p: {
    attemptId: string;
    amountCents: number;
    currency: string;
    status: PaymentStatus;
  },
): string {
  const body = b64(JSON.stringify(p));
  return `${body}.${hmacHex(secret, body)}`;
}

export function signWebhookBody(secret: string, rawBody: string): string {
  return hmacHex(secret, rawBody);
}

export function createFakeProvider(opts: {
  secret: string;
  appUrl: string;
}): PaymentProvider {
  const { secret, appUrl } = opts;
  return {
    name: "fake",

    async createCheckout(attempt: AttemptForCheckout) {
      return {
        redirectUrl: new URL(
          `/checkout/fake/${attempt.id}`,
          new URL(appUrl).origin,
        ).toString(),
        providerRef: makePaymentRef(secret, {
          attemptId: attempt.id,
          amountCents: attempt.amountCents,
          currency: attempt.currency,
          status: "pending",
        }),
      };
    },

    verifyWebhook(rawBody: string, headers: Headers): WebhookEvent | null {
      // (the request URL, the third interface argument, is not part of the fake signature)
      const sig = headers.get(SIGNATURE_HEADER);
      if (!sig || !safeEqualHex(sig, hmacHex(secret, rawBody))) return null;
      try {
        const o = JSON.parse(rawBody) as Record<string, unknown>;
        if (typeof o.eventId !== "string" || typeof o.paymentRef !== "string")
          return null;
        return { eventId: o.eventId, paymentRef: o.paymentRef };
      } catch {
        return null;
      }
    },

    async fetchPayment(paymentRef: string): Promise<PaymentInfo> {
      const [body, sig, extra] = paymentRef.split(".");
      if (!body || !sig || extra !== undefined)
        throw new PaymentNotFound("malformed ref");
      if (!safeEqualHex(sig, hmacHex(secret, body)))
        throw new PaymentNotFound("bad ref signature");
      try {
        const o = JSON.parse(unb64(body)) as PaymentInfo;
        if (
          typeof o.attemptId !== "string" ||
          typeof o.amountCents !== "number" ||
          typeof o.currency !== "string" ||
          !["paid", "pending", "failed", "expired"].includes(o.status)
        )
          throw new Error("shape");
        return {
          status: o.status,
          amountCents: o.amountCents,
          currency: o.currency,
          attemptId: o.attemptId,
        };
      } catch {
        throw new PaymentNotFound("malformed ref body");
      }
    },
  };
}
