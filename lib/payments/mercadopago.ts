import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PaymentLookupUnavailable,
  PaymentNotFound,
  type AttemptForCheckout,
  type PaymentInfo,
  type PaymentProvider,
  type PaymentStatus,
  type WebhookVerification,
} from "./types";

// Mercado Pago (Checkout Pro) over plain fetch: no SDK, no dependency (CLAUDE.md §0).
//
// UNVERIFIED AGAINST CURRENT DOCS: when this was written the MP developer pages were unreachable
// from the build environment, so every MP-specific detail below (endpoint paths, field names, the
// `x-signature` manifest, `live_mode`, `status_detail` values) comes from the supervisor's
// description and memory and is marked "UNVERIFIED". Nothing here has talked to the real API.
// The sandbox round-trip gate in IMPLEMENTATION_PLAN.md phase 9b is open for exactly this reason.

const DEFAULT_BASE = "https://api.mercadopago.com";
const TIMEOUT_MS = 8000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MercadoPagoOptions = {
  accessToken: string;
  webhookSecret: string;
  appUrl: string;
  /** true only in production: a payment whose `live_mode` differs is treated as not ours. */
  expectLive: boolean;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

/** 1000 -> "10.00", 1 -> "0.01". Integer math on strings; no float arithmetic on money. */
export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new RangeError("cents must be a non-negative integer");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/**
 * MP amount (a JSON number, e.g. 123.45) -> integer cents, rounding half-up on the DECIMAL STRING.
 * Returns null for anything that is not a plain non-negative decimal.
 */
export function decimalToCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return null;
  const s = String(value); // shortest round-trip representation, e.g. "123.45"
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s); // rejects exponent forms (1e21)
  if (!m) return null;
  const frac = (m[2] ?? "").padEnd(3, "0");
  const cents = Number(m[1]) * 100 + Number(frac.slice(0, 2));
  const out = cents + (Number(frac[2]) >= 5 ? 1 : 0);
  return Number.isSafeInteger(out) ? out : null;
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

function parseSignatureHeader(h: string): { ts: string; v1: string } | null {
  const parts: Record<string, string> = {};
  for (const piece of h.split(",")) {
    const i = piece.indexOf("=");
    if (i < 1) return null;
    parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
  }
  if (
    !/^\d{1,16}$/.test(parts.ts ?? "") ||
    !/^[0-9a-f]{64}$/i.test(parts.v1 ?? "")
  )
    return null;
  return { ts: parts.ts, v1: parts.v1.toLowerCase() };
}

/** UNVERIFIED mapping of MP `status` (+ `status_detail`). Unknown statuses are treated as pending (provision nothing). */
export function mapStatus(status: unknown, detail: unknown): PaymentStatus {
  switch (status) {
    case "approved":
      return "paid";
    case "rejected":
      return "failed";
    case "cancelled":
      // UNVERIFIED: a Pix that nobody paid in time shows as cancelled with status_detail "expired".
      return detail === "expired" ? "expired" : "failed";
    case "expired":
      return "expired";
    case "refunded":
      return "refunded";
    case "charged_back":
      return "charged_back";
    default: // pending, in_process, in_mediation, authorized, and anything new
      return "pending";
  }
}

export function createMercadoPagoProvider(
  opts: MercadoPagoOptions,
): PaymentProvider {
  const base = opts.baseUrl ?? DEFAULT_BASE;
  const doFetch = opts.fetchImpl ?? fetch;
  const appOrigin = new URL(opts.appUrl).origin;

  /** Never puts the token, the response body or the payer into an error or a log line. */
  async function call(
    path: string,
    init: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<{ status: number; json: unknown }> {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${opts.accessToken}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new PaymentLookupUnavailable(
        `mercadopago unreachable (${err instanceof Error ? err.name : "error"})`,
      );
    }
    if (res.status >= 500 || res.status === 429)
      throw new PaymentLookupUnavailable(`mercadopago ${res.status}`);
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON body: handled by callers via status */
    }
    return { status: res.status, json };
  }

  return {
    name: "mercadopago",

    async createCheckout(attempt: AttemptForCheckout) {
      const notificationUrl = `${appOrigin}/api/webhooks/payments`;
      if (opts.expectLive && !notificationUrl.startsWith("https://"))
        throw new Error(
          "mercadopago: refusing a non-https notification_url in production",
        );
      const returnUrl = `${appOrigin}/checkout/return?attempt=${attempt.id}`;
      const { status, json } = await call("/checkout/preferences", {
        method: "POST",
        // Same attempt id = same preference if the request is retried.
        headers: { "X-Idempotency-Key": attempt.id },
        body: {
          external_reference: attempt.id,
          items: [
            {
              id: "subscription",
              title: "ComplyStart",
              quantity: 1,
              currency_id: attempt.currency,
              unit_price: Number(centsToDecimal(attempt.amountCents)),
            },
          ],
          payer: { email: attempt.billingEmail },
          // Pix stays available; boleto ("ticket") is excluded: its multi-day pending state is out of scope.
          payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
          back_urls: {
            success: returnUrl,
            pending: returnUrl,
            failure: returnUrl,
          },
          auto_return: "approved",
          ...(notificationUrl.startsWith("https://")
            ? { notification_url: notificationUrl }
            : {}),
        },
      });
      const o = (json ?? {}) as Record<string, unknown>;
      const url = opts.expectLive
        ? o.init_point
        : (o.sandbox_init_point ?? o.init_point);
      if (status >= 300 || typeof o.id !== "string" || typeof url !== "string")
        throw new Error(`mercadopago: preference not created (HTTP ${status})`);
      return { redirectUrl: url, providerRef: o.id };
    },

    /**
     * UNVERIFIED manifest: `id:<data.id from the URL query, lowercased>;request-id:<x-request-id>;ts:<ts>;`
     * HMAC-SHA256 (hex) with the application's webhook secret, compared with `v1` in `x-signature`.
     * A part whose value is absent is left out of the manifest.
     * No timestamp-tolerance window on purpose: MP retries later with new timestamps; the protection
     * is idempotency (ledger on payment id + status) and re-fetching the payment from the API.
     */
    verifyWebhook(rawBody, headers, url): WebhookVerification {
      if (!opts.webhookSecret) return null;
      const header = headers.get("x-signature");
      if (!header) return null;
      const sig = parseSignatureHeader(header);
      if (!sig) return null;
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        return null;
      }
      const rawId = u.searchParams.get("data.id");
      const dataId =
        rawId === null
          ? null
          : /^[a-z0-9]+$/i.test(rawId)
            ? rawId.toLowerCase()
            : rawId;
      const requestId = headers.get("x-request-id");
      const manifest =
        (dataId ? `id:${dataId};` : "") +
        (requestId ? `request-id:${requestId};` : "") +
        `ts:${sig.ts};`;
      const expected = createHmac("sha256", opts.webhookSecret)
        .update(manifest)
        .digest("hex");
      if (!safeEqualHex(sig.v1, expected)) return null;

      // Authentic. Only now is anything read from the body (and only to learn the notification type).
      let type = u.searchParams.get("type") ?? u.searchParams.get("topic");
      if (!type) {
        try {
          const b = JSON.parse(rawBody) as Record<string, unknown>;
          if (typeof b.type === "string") type = b.type;
        } catch {
          /* no usable body */
        }
      }
      if (type !== "payment" || !rawId) return { ignored: true };
      // Event id = payment id, so MP's redelivery of the same payment is a replay.
      return { eventId: rawId, paymentRef: rawId };
    },

    async fetchPayment(paymentRef: string): Promise<PaymentInfo> {
      if (!/^\d{1,20}$/.test(paymentRef))
        throw new PaymentNotFound("malformed payment id");
      const { status, json } = await call(
        `/v1/payments/${encodeURIComponent(paymentRef)}`,
      );
      if (status === 404 || status === 400) throw new PaymentNotFound();
      if (status >= 300)
        throw new PaymentLookupUnavailable(`mercadopago ${status}`);
      const p = (json ?? {}) as Record<string, unknown>;
      const attemptId = p.external_reference;
      if (typeof attemptId !== "string" || !UUID.test(attemptId))
        throw new PaymentNotFound("no external_reference");
      // UNVERIFIED: `live_mode`. Fail closed: a missing flag is not trusted either.
      if (p.live_mode !== opts.expectLive)
        throw new PaymentNotFound("live_mode mismatch");
      const amountCents = decimalToCents(p.transaction_amount);
      if (amountCents === null || typeof p.currency_id !== "string")
        throw new PaymentNotFound("unreadable amount");

      let mapped = mapStatus(p.status, p.status_detail);
      const refundedRaw = decimalToCents(p.transaction_amount_refunded) ?? 0;
      // Fully refunded but still labelled approved: treat as refunded.
      if (mapped === "paid" && refundedRaw > 0 && refundedRaw >= amountCents)
        mapped = "refunded";
      const info: PaymentInfo = {
        status: mapped,
        amountCents,
        currency: p.currency_id,
        attemptId: attemptId.toLowerCase(),
      };
      if (mapped === "paid") {
        info.ledgerStatus = "approved";
        if (refundedRaw > 0) info.refundedCents = refundedRaw;
      }
      if (mapped === "refunded") info.ledgerStatus = "refunded";
      if (mapped === "charged_back") info.ledgerStatus = "charged_back";
      return info;
    },

    /** UNVERIFIED: GET /v1/payments/search?external_reference=… -> { results: [{ id }] } */
    async findPayments(attemptId: string): Promise<string[]> {
      const q = new URLSearchParams({
        external_reference: attemptId,
        sort: "date_created",
        criteria: "asc",
        limit: "10",
      });
      const { status, json } = await call(`/v1/payments/search?${q}`);
      if (status >= 300)
        throw new PaymentLookupUnavailable(`mercadopago ${status}`);
      const results = (json as { results?: unknown })?.results;
      if (!Array.isArray(results)) return [];
      return results
        .map((r) => (r as { id?: unknown })?.id)
        .filter(
          (id): id is number | string =>
            typeof id === "number" || typeof id === "string",
        )
        .map(String);
    },
  };
}
