// @vitest-environment node
// FIXTURES BELOW ARE HAND-WRITTEN FROM THE SUPERVISOR'S DESCRIPTION OF THE MERCADO PAGO API, NOT
// RECORDED from a real sandbox, and the MP docs were unreachable when they were written. They prove
// our code's logic, not that MP behaves this way (see HANDOFF.md / IMPLEMENTATION_PLAN.md 9b gates).
import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAttempt } from "@/lib/checkout/attempt";
import { schema } from "@/lib/db/client";
import { TERMS_VERSION } from "@/lib/legal/version";
import { resolveProvider } from "@/lib/payments";
import {
  centsToDecimal,
  createMercadoPagoProvider,
  decimalToCents,
} from "@/lib/payments/mercadopago";
import {
  reconcilePending,
  reconcileToken,
  reconcileTokenValid,
} from "@/lib/payments/reconcile";
import {
  PaymentLookupUnavailable,
  PaymentNotFound,
} from "@/lib/payments/types";
import { handlePaymentWebhook } from "@/lib/payments/webhook";
import { uid, useTestDb } from "./helpers/db";

const { users, billingRecords, checkoutAttempt, paymentEvent, companies } =
  schema;
const SECRET = "wh-secret-for-tests-only";
const TOKEN = "TEST-access-token-for-tests-only";
const HOOK = "https://staging.example.test/api/webhooks/payments";
const VALID_CNPJ = "11.222.333/0001-81";

type MpPayment = Record<string, unknown>;
const payments = new Map<string, MpPayment>();
let failMode: "none" | "500" | "429" | "timeout" | "network" = "none";
const calls: { url: string; init?: RequestInit }[] = [];

const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  calls.push({ url: u, init });
  if (failMode === "500") return new Response("{}", { status: 500 });
  if (failMode === "429") return new Response("{}", { status: 429 });
  if (failMode === "timeout") throw new DOMException("t", "TimeoutError");
  if (failMode === "network") throw new TypeError("fetch failed");
  const m = /\/v1\/payments\/(\d+)$/.exec(u);
  if (m) {
    const p = payments.get(m[1]);
    return p
      ? new Response(JSON.stringify(p), { status: 200 })
      : new Response("{}", { status: 404 });
  }
  if (u.includes("/v1/payments/search")) {
    const ref = new URL(u).searchParams.get("external_reference");
    const results = [...payments.entries()]
      .filter(([, p]) => p.external_reference === ref)
      .map(([id]) => ({ id: Number(id) }));
    return new Response(JSON.stringify({ results }), { status: 200 });
  }
  if (u.endsWith("/checkout/preferences"))
    return new Response(
      JSON.stringify({
        id: "pref-123",
        init_point:
          "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123",
        sandbox_init_point:
          "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123",
      }),
      { status: 201 },
    );
  return new Response("{}", { status: 404 });
}) as unknown as typeof fetch;

const make = (
  over: { expectLive?: boolean; webhookSecret?: string; appUrl?: string } = {},
) =>
  createMercadoPagoProvider({
    accessToken: TOKEN,
    webhookSecret: over.webhookSecret ?? SECRET,
    appUrl: over.appUrl ?? "https://staging.example.test",
    expectLive: over.expectLive ?? false,
    fetchImpl: fakeFetch,
  });
const provider = make();

let db: ReturnType<typeof useTestDb>;
let outbox: string;
beforeAll(() => {
  db = useTestDb();
});
beforeEach(() => {
  outbox = mkdtempSync(path.join(tmpdir(), "outbox-"));
  vi.stubEnv("ENABLED_COUNTRIES", "br");
  vi.stubEnv("EMAIL_DEV_SINK", "true");
  vi.stubEnv("EMAIL_SINK_DIR", outbox);
  vi.stubEnv("APP_URL", "https://staging.example.test");
  vi.stubEnv("OPS_ALERT_EMAIL", "ops@example.test");
  payments.clear();
  failMode = "none";
  calls.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const newAttempt = async () => {
  const r = await createAttempt(db, provider, {
    country: "br",
    companyName: `Acme ${uid()}`,
    taxId: VALID_CNPJ,
    billingEmail: `buyer-${uid()}@example.test`,
    utm: null,
    termsAccepted: true,
    termsVersion: TERMS_VERSION,
  });
  if (!r.ok) throw new Error(`createAttempt failed: ${r.error}`);
  const [attempt] = await db
    .select()
    .from(checkoutAttempt)
    .where(eq(checkoutAttempt.id, r.attemptId));
  return attempt;
};

let nextId = Math.floor(Math.random() * 1e12); // payment ids are globally unique at MP; the ledger persists across runs
const mpPayment = (
  attempt: { id: string; amountCents: number },
  over: MpPayment = {},
) => {
  const id = String(++nextId);
  payments.set(id, {
    id: Number(id),
    status: "approved",
    status_detail: "accredited",
    external_reference: attempt.id,
    transaction_amount: Number(centsToDecimal(attempt.amountCents)),
    currency_id: "BRL",
    live_mode: false,
    ...over,
  });
  return id;
};

const signedRequest = (
  dataId: string,
  opts: {
    secret?: string;
    requestId?: string;
    ts?: string;
    type?: string;
    sigDataId?: string;
  } = {},
) => {
  const requestId = opts.requestId ?? randomUUID();
  const ts = opts.ts ?? "1700000000000";
  const manifest = `id:${(opts.sigDataId ?? dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", opts.secret ?? SECRET)
    .update(manifest)
    .digest("hex");
  const url = `${HOOK}?data.id=${dataId}&type=${opts.type ?? "payment"}`;
  const headers = new Headers({
    "x-signature": `ts=${ts},v1=${v1}`,
    "x-request-id": requestId,
  });
  return {
    url,
    headers,
    raw: JSON.stringify({
      action: "payment.updated",
      type: opts.type ?? "payment",
      data: { id: dataId },
    }),
  };
};
const deliver = (
  dataId: string,
  opts: Parameters<typeof signedRequest>[1] = {},
) => {
  const r = signedRequest(dataId, opts);
  return handlePaymentWebhook(db, provider, r.raw, r.headers, r.url);
};
const alerts = () =>
  readdirSync(outbox)
    .map(
      (f) =>
        JSON.parse(readFileSync(path.join(outbox, f), "utf8")) as {
          to: string;
          subject: string;
          text: string;
        },
    )
    .filter((m) => m.to === "ops@example.test");
const usersFor = (email: string) =>
  db.select().from(users).where(eq(users.email, email));

describe("amount conversion (integer math)", () => {
  it("cents -> decimal", () => {
    expect(centsToDecimal(1000)).toBe("10.00");
    expect(centsToDecimal(1)).toBe("0.01");
    expect(centsToDecimal(12345)).toBe("123.45");
    expect(centsToDecimal(0)).toBe("0.00");
    expect(() => centsToDecimal(1.5)).toThrow();
    expect(() => centsToDecimal(-1)).toThrow();
  });
  it("decimal -> cents, rounding on the decimal string", () => {
    expect(decimalToCents(10)).toBe(1000);
    expect(decimalToCents(0.01)).toBe(1);
    expect(decimalToCents(123.45)).toBe(12345);
    expect(decimalToCents(19.99)).toBe(1999);
    expect(decimalToCents(1.005)).toBe(101); // half-up on the string, not float noise (1.005*100 = 100.49999)
    expect(decimalToCents(1.004)).toBe(100);
    expect(decimalToCents(-1)).toBeNull();
    expect(decimalToCents("10.00")).toBeNull();
    expect(decimalToCents(1e21)).toBeNull();
    expect(decimalToCents(NaN)).toBeNull();
  });
});

describe("createCheckout", () => {
  const att = {
    id: randomUUID(),
    amountCents: 12345,
    currency: "BRL",
    companyName: "X",
    billingEmail: "p@example.test",
    country: "br",
  };
  it("sends the preference with external_reference, BRL, ticket excluded, https notification_url, idempotency key", async () => {
    const r = await provider.createCheckout(att);
    expect(r).toEqual({
      redirectUrl:
        "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123",
      providerRef: "pref-123",
    });
    const call = calls[0];
    expect(call.url).toBe("https://api.mercadopago.com/checkout/preferences");
    const h = call.init?.headers as Record<string, string>;
    expect(h["X-Idempotency-Key"]).toBe(att.id);
    expect(h.Authorization).toBe(`Bearer ${TOKEN}`);
    const b = JSON.parse(call.init?.body as string);
    expect(b.external_reference).toBe(att.id);
    expect(b.items).toEqual([
      expect.objectContaining({
        quantity: 1,
        currency_id: "BRL",
        unit_price: 123.45,
      }),
    ]);
    expect(b.payer.email).toBe("p@example.test");
    expect(b.payment_methods.excluded_payment_types).toEqual([
      { id: "ticket" },
    ]);
    expect(b.notification_url).toBe(
      "https://staging.example.test/api/webhooks/payments",
    );
    expect(b.back_urls.success).toBe(
      `https://staging.example.test/checkout/return?attempt=${att.id}`,
    );
    expect(b.auto_return).toBe("approved");
  });
  it("live mode uses the live checkout URL; production refuses a non-https notification_url", async () => {
    const live = make({ expectLive: true });
    expect((await live.createCheckout(att)).redirectUrl).toContain(
      "www.mercadopago.com.br",
    );
    const insecure = make({ expectLive: true, appUrl: "http://example.test" });
    await expect(insecure.createCheckout(att)).rejects.toThrow(/https/);
  });
  it("a failing preference call throws without leaking the token", async () => {
    failMode = "500";
    await expect(provider.createCheckout(att)).rejects.toSatisfy(
      (e: Error) => !e.message.includes(TOKEN),
    );
  });
});

describe("verifyWebhook", () => {
  const verify = (r: ReturnType<typeof signedRequest>, p = provider) =>
    p.verifyWebhook(r.raw, r.headers, r.url);
  it("valid signature -> event with payment id as event id and ref", async () => {
    expect(await verify(signedRequest("123456"))).toEqual({
      eventId: "123456",
      paymentRef: "123456",
    });
  });
  it("wrong secret / altered data.id / altered request-id / garbled or missing header / empty secret -> null", async () => {
    expect(
      await verify(signedRequest("123456", { secret: "other" })),
    ).toBeNull();
    expect(
      await verify(signedRequest("123456", { sigDataId: "999" })),
    ).toBeNull();
    const r = signedRequest("123456");
    r.headers.set("x-request-id", "someone-elses");
    expect(await verify(r)).toBeNull();
    for (const bad of [
      "",
      "garbage",
      "ts=abc,v1=" + "0".repeat(64),
      "ts=1,v1=zz",
      "v1=" + "0".repeat(64),
    ]) {
      const g = signedRequest("123456");
      g.headers.set("x-signature", bad);
      expect(await verify(g)).toBeNull();
    }
    const missing = signedRequest("123456");
    missing.headers.delete("x-signature");
    expect(await verify(missing)).toBeNull();
    expect(
      await verify(
        signedRequest("123456", { secret: "" }),
        make({ webhookSecret: "" }),
      ),
    ).toBeNull();
  });
  it("authentic non-payment notification -> ignored; the body is not needed for a payment", async () => {
    expect(
      await verify(signedRequest("555", { type: "merchant_order" })),
    ).toEqual({ ignored: true });
    const r = signedRequest("123456");
    expect(await provider.verifyWebhook("not json", r.headers, r.url)).toEqual({
      eventId: "123456",
      paymentRef: "123456",
    });
  });
});

describe("fetchPayment", () => {
  const att = { id: randomUUID(), amountCents: 1000 };
  it("maps every status", async () => {
    const map: [Record<string, unknown>, string][] = [
      [{ status: "approved" }, "paid"],
      [{ status: "pending" }, "pending"],
      [{ status: "in_process" }, "pending"],
      [{ status: "in_mediation" }, "pending"],
      [{ status: "authorized" }, "pending"],
      [{ status: "rejected" }, "failed"],
      [{ status: "cancelled" }, "failed"],
      [{ status: "cancelled", status_detail: "expired" }, "expired"],
      [{ status: "refunded" }, "refunded"],
      [{ status: "charged_back" }, "charged_back"],
      [{ status: "something_new" }, "pending"],
    ];
    for (const [over, want] of map) {
      const id = mpPayment(att, over);
      expect(
        (await provider.fetchPayment(id)).status,
        JSON.stringify(over),
      ).toBe(want);
    }
  });
  it("returns attempt id, cents, currency, ledger status", async () => {
    const id = mpPayment({ id: att.id, amountCents: 12345 });
    expect(await provider.fetchPayment(id)).toEqual({
      status: "paid",
      amountCents: 12345,
      currency: "BRL",
      attemptId: att.id,
      ledgerStatus: "approved",
    });
  });
  it("partial refund is paid + refundedCents; full refund on an 'approved' payment counts as refunded", async () => {
    const part = mpPayment(att, { transaction_amount_refunded: 2.5 });
    expect(await provider.fetchPayment(part)).toMatchObject({
      status: "paid",
      refundedCents: 250,
    });
    const full = mpPayment(att, { transaction_amount_refunded: 10 });
    expect((await provider.fetchPayment(full)).status).toBe("refunded");
  });
  it("404, malformed id, no external_reference -> PaymentNotFound", async () => {
    await expect(provider.fetchPayment("424242")).rejects.toBeInstanceOf(
      PaymentNotFound,
    );
    await expect(provider.fetchPayment("../x")).rejects.toBeInstanceOf(
      PaymentNotFound,
    );
    const noRef = mpPayment(att, { external_reference: null });
    await expect(provider.fetchPayment(noRef)).rejects.toBeInstanceOf(
      PaymentNotFound,
    );
    const badRef = mpPayment(att, { external_reference: "not-a-uuid" });
    await expect(provider.fetchPayment(badRef)).rejects.toBeInstanceOf(
      PaymentNotFound,
    );
  });
  it("live_mode mismatch, both ways, and a missing flag -> PaymentNotFound", async () => {
    const sandbox = mpPayment(att, { live_mode: false });
    const live = mpPayment(att, { live_mode: true });
    const none = mpPayment(att, { live_mode: undefined });
    await expect(
      make({ expectLive: true }).fetchPayment(sandbox),
    ).rejects.toBeInstanceOf(PaymentNotFound);
    await expect(
      make({ expectLive: false }).fetchPayment(live),
    ).rejects.toBeInstanceOf(PaymentNotFound);
    await expect(provider.fetchPayment(none)).rejects.toBeInstanceOf(
      PaymentNotFound,
    );
    expect((await make({ expectLive: true }).fetchPayment(live)).status).toBe(
      "paid",
    );
  });
  it("timeout, network error, 5xx, 429 -> PaymentLookupUnavailable, without the token in the message", async () => {
    const id = mpPayment(att);
    for (const m of ["500", "429", "timeout", "network"] as const) {
      failMode = m;
      const e = await provider.fetchPayment(id).catch((x) => x);
      expect(e, m).toBeInstanceOf(PaymentLookupUnavailable);
      expect(e.message).not.toContain(TOKEN);
    }
  });
  it("uses a timeout signal", async () => {
    await provider.fetchPayment(mpPayment(att));
    expect(calls[0].init?.signal).toBeDefined();
  });
});

describe("webhook -> database (real Postgres)", () => {
  it("approved -> one Company/User/BillingRecord + welcome mail; same delivery again -> replay; two at once -> one Company", async () => {
    const a = await newAttempt();
    const pid = mpPayment(a);
    const [r1, r2] = await Promise.all([deliver(pid), deliver(pid)]);
    expect([r1.body.outcome, r2.body.outcome].sort()).toEqual([
      "provisioned",
      "replay",
    ]);
    expect(await usersFor(a.billingEmail)).toHaveLength(1);
    const r3 = await deliver(pid);
    expect(r3.body.outcome).toBe("replay");
    expect(await usersFor(a.billingEmail)).toHaveLength(1);
    const keys = await db
      .select()
      .from(paymentEvent)
      .where(eq(paymentEvent.attemptId, a.id));
    expect(keys.map((k) => k.eventKey)).toEqual([
      `mercadopago:${pid}:approved`,
    ]);
    expect(
      readdirSync(outbox).filter(
        (f) =>
          JSON.parse(readFileSync(path.join(outbox, f), "utf8")).to ===
          a.billingEmail,
      ),
    ).toHaveLength(1);
  });
  it("forged signature -> 401, nothing created, no alert", async () => {
    const a = await newAttempt();
    const pid = mpPayment(a);
    const r = await deliver(pid, { secret: "forged" });
    expect(r.status).toBe(401);
    expect(await usersFor(a.billingEmail)).toHaveLength(0);
    expect(alerts()).toHaveLength(0);
  });
  it("non-payment notification -> 200 ignored", async () => {
    const r = await deliver("777", { type: "merchant_order" });
    expect(r).toEqual({ status: 200, body: { ok: true, outcome: "ignored" } });
  });
  it("rejected -> attempt failed, no company; a later approved payment for the same attempt still provisions", async () => {
    const a = await newAttempt();
    const bad = mpPayment(a, {
      status: "rejected",
      status_detail: "cc_rejected_other_reason",
    });
    expect((await deliver(bad)).body.outcome).toBe("marked_failed");
    expect(await usersFor(a.billingEmail)).toHaveLength(0);
    const good = mpPayment(a);
    expect((await deliver(good)).body.outcome).toBe("provisioned");
  });
  it("pending stays pending, then approved provisions", async () => {
    const a = await newAttempt();
    const pid = mpPayment(a, {
      status: "pending",
      status_detail: "pending_waiting_transfer",
    });
    expect((await deliver(pid)).body.outcome).toBe("still_pending");
    payments.get(pid)!.status = "approved";
    expect((await deliver(pid)).body.outcome).toBe("provisioned");
  });
  it("unknown attempt -> 422 + alert; amount mismatch and currency mismatch -> 422, nothing provisioned, alert", async () => {
    const ghost = mpPayment({ id: randomUUID(), amountCents: 1000 });
    const r = await deliver(ghost);
    expect(r.status).toBe(422);
    const a = await newAttempt();
    const wrong = mpPayment({ id: a.id, amountCents: 1 });
    expect((await deliver(wrong)).body.outcome).toBe("mismatch");
    const cur = mpPayment(a, { currency_id: "USD" });
    expect((await deliver(cur)).status).toBe(422);
    expect(await usersFor(a.billingEmail)).toHaveLength(0);
    const subjects = alerts().map((m) => m.subject);
    expect(subjects.filter((s) => /unknown/.test(s))).toHaveLength(1);
    expect(subjects.filter((s) => /does not match/.test(s))).toHaveLength(2);
  });
  it("live_mode mismatch -> 422 and nothing provisioned", async () => {
    const a = await newAttempt();
    const pid = mpPayment(a, { live_mode: true });
    expect((await deliver(pid)).status).toBe(422);
    expect(await usersFor(a.billingEmail)).toHaveLength(0);
  });
  it("timeout / 5xx -> 503 so MP retries", async () => {
    const a = await newAttempt();
    const pid = mpPayment(a);
    failMode = "500";
    expect((await deliver(pid)).status).toBe(503);
    failMode = "timeout";
    expect((await deliver(pid)).status).toBe(503);
  });
  it("paid but e-mail already has an account -> failed + PAID BUT NOT PROVISIONED alert (no personal data)", async () => {
    const a = await newAttempt();
    const [c] = await db
      .insert(companies)
      .values({ name: "Other", slug: `o-${uid()}`, taxId: "1", country: "br" })
      .returning();
    await db.insert(users).values({ companyId: c.id, email: a.billingEmail });
    const pid = mpPayment(a);
    expect((await deliver(pid)).body.outcome).toBe("email_conflict");
    const m = alerts().find((x) => /PAID BUT NOT PROVISIONED/.test(x.subject))!;
    expect(m.text).toContain(a.id);
    expect(m.text).toContain(pid);
    expect(m.text).not.toContain(a.billingEmail);
    expect(m.text).not.toContain(a.companyName);
  });
  it("full refund sets refunded_at once, keeps the company, alerts once; replay does nothing; partial only alerts", async () => {
    const a = await newAttempt();
    const pid = mpPayment(a);
    await deliver(pid);
    const [u] = await usersFor(a.billingEmail);
    // partial refund first
    payments.get(pid)!.transaction_amount_refunded = 2.5;
    expect((await deliver(pid)).body.outcome).toBe("partial_refund");
    expect((await deliver(pid)).body.outcome).toBe("replay");
    let [rec] = await db
      .select()
      .from(billingRecords)
      .where(eq(billingRecords.companyId, u.companyId));
    expect(rec.refundedAt).toBeNull();
    // full refund
    payments.get(pid)!.status = "refunded";
    payments.get(pid)!.transaction_amount_refunded = 10;
    expect((await deliver(pid)).body.outcome).toBe("refunded");
    [rec] = await db
      .select()
      .from(billingRecords)
      .where(eq(billingRecords.companyId, u.companyId));
    expect(rec.refundedAt).not.toBeNull();
    const first = rec.refundedAt;
    expect((await deliver(pid)).body.outcome).toBe("replay");
    [rec] = await db
      .select()
      .from(billingRecords)
      .where(eq(billingRecords.companyId, u.companyId));
    expect(rec.refundedAt).toEqual(first);
    expect(
      await db.select().from(companies).where(eq(companies.id, u.companyId)),
    ).toHaveLength(1);
    expect(
      alerts().filter((m) => /Payment refunded/.test(m.subject)),
    ).toHaveLength(1);
    const keys = (
      await db
        .select()
        .from(paymentEvent)
        .where(eq(paymentEvent.attemptId, a.id))
    )
      .map((k) => k.eventKey)
      .sort();
    expect(keys).toEqual(
      [
        `mercadopago:${pid}:approved`,
        `mercadopago:${pid}:partial_refund_250`,
        `mercadopago:${pid}:refunded`,
      ].sort(),
    );
  });
  it("chargeback is recorded like a refund", async () => {
    const a = await newAttempt();
    const pid = mpPayment(a);
    await deliver(pid);
    payments.get(pid)!.status = "charged_back";
    expect((await deliver(pid)).body.outcome).toBe("refunded");
    expect(alerts().some((m) => /charged back/.test(m.subject))).toBe(true);
  });
  it("refund of a payment that never provisioned -> alert only", async () => {
    const a = await newAttempt();
    const pid = mpPayment(a, { status: "refunded" });
    expect((await deliver(pid)).body.outcome).toBe("refund_unprovisioned");
  });
  it("no OPS_ALERT_EMAIL -> log only; an unsendable alert never changes the response", async () => {
    vi.stubEnv("OPS_ALERT_EMAIL", "");
    const ghost = mpPayment({ id: randomUUID(), amountCents: 1000 });
    expect((await deliver(ghost)).status).toBe(422);
    expect(alerts()).toHaveLength(0);
    vi.stubEnv("OPS_ALERT_EMAIL", "ops@example.test");
    vi.stubEnv("EMAIL_SINK_DIR", "/etc/hostname/not-a-directory");
    expect(
      (await deliver(mpPayment({ id: randomUUID(), amountCents: 1000 })))
        .status,
    ).toBe(422);
  });
});

describe("reconciler", () => {
  // other tests (and earlier runs) leave old pending attempts; the batch limit would see them first
  beforeEach(async () => {
    await db
      .update(checkoutAttempt)
      .set({ status: "failed" })
      .where(eq(checkoutAttempt.status, "pending"));
  });
  const old = async (a: { id: string }, ms: number) =>
    db
      .update(checkoutAttempt)
      .set({ createdAt: new Date(Date.now() - ms) })
      .where(eq(checkoutAttempt.id, a.id));
  // The reconciler runs against attempts of provider "mercadopago" only; our test attempts are.
  it("picks up a payment whose webhook was lost; second run changes nothing", async () => {
    const a = await newAttempt();
    await old(a, 10 * 60_000);
    mpPayment(a);
    const s1 = await reconcilePending(db, provider);
    expect(s1).toMatchObject({
      checked: expect.any(Number),
      changed: expect.any(Number),
      errors: 0,
    });
    expect(await usersFor(a.billingEmail)).toHaveLength(1);
    const s2 = await reconcilePending(db, provider);
    expect(s2.changed).toBe(0);
    expect(await usersFor(a.billingEmail)).toHaveLength(1);
  });
  it("skips attempts younger than 5 minutes and older than 7 days", async () => {
    const young = await newAttempt();
    const ancient = await newAttempt();
    await old(ancient, 8 * 24 * 3600_000);
    mpPayment(young);
    mpPayment(ancient);
    await reconcilePending(db, provider);
    expect(await usersFor(young.billingEmail)).toHaveLength(0);
    expect(await usersFor(ancient.billingEmail)).toHaveLength(0);
  });
  it("is bounded to 50 attempts per run and isolates failures", async () => {
    await db
      .update(checkoutAttempt)
      .set({ status: "failed" })
      .where(eq(checkoutAttempt.status, "pending"));
    for (let i = 0; i < 53; i++) {
      const a = await newAttempt();
      await old(a, 10 * 60_000 + i);
    }
    const s = await reconcilePending(db, provider);
    expect(s.checked).toBe(50);
    failMode = "500";
    const s2 = await reconcilePending(db, provider);
    expect(s2.unavailable).toBe(50);
    expect(s2.errors).toBe(0);
  });
  it("a rejected payment marks the attempt failed", async () => {
    const a = await newAttempt();
    await old(a, 10 * 60_000);
    mpPayment(a, { status: "rejected" });
    await reconcilePending(db, provider);
    const [row] = await db
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, a.id));
    expect(row.status).toBe("failed");
  });
  it("route token: derived from the webhook secret, compared safely", () => {
    const t = reconcileToken(SECRET);
    expect(reconcileTokenValid(t, SECRET)).toBe(true);
    expect(reconcileTokenValid(t, "other")).toBe(false);
    expect(reconcileTokenValid(null, SECRET)).toBe(false);
    expect(reconcileTokenValid(t, "")).toBe(false);
  });
});

describe("resolveProvider(mercadopago) and the placeholder price", () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
  it("needs both secrets, else unavailable (no throw)", () => {
    expect(
      resolveProvider(
        env({
          PAYMENT_PROVIDER: "mercadopago",
          MERCADOPAGO_ACCESS_TOKEN: TOKEN,
        }),
      ).available,
    ).toBe(false);
    expect(
      resolveProvider(
        env({
          PAYMENT_PROVIDER: "mercadopago",
          MERCADOPAGO_ACCESS_TOKEN: "changeme",
          MERCADOPAGO_WEBHOOK_SECRET: "changeme",
        }),
      ).available,
    ).toBe(false);
    const r = resolveProvider(
      env({
        PAYMENT_PROVIDER: "mercadopago",
        MERCADOPAGO_ACCESS_TOKEN: TOKEN,
        MERCADOPAGO_WEBHOOK_SECRET: SECRET,
        APP_ENV: "staging",
      }),
    );
    expect(r.available && r.provider.name).toBe("mercadopago");
  });
  it("a placeholder price is refused in production, allowed on staging", async () => {
    const input = {
      country: "br",
      companyName: "Acme Test",
      taxId: VALID_CNPJ,
      billingEmail: `p-${uid()}@example.test`,
      utm: null,
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
    };
    vi.stubEnv("APP_ENV", "production");
    const refused = await createAttempt(db, make({ expectLive: true }), input);
    expect(refused).toEqual({ ok: false, error: "unavailable" });
    vi.stubEnv("APP_ENV", "staging");
    expect(
      (
        await createAttempt(db, provider, {
          ...input,
          billingEmail: `q-${uid()}@example.test`,
        })
      ).ok,
    ).toBe(true);
  });
});
