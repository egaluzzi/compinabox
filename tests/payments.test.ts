// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { readdirSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAttempt } from "@/lib/checkout/attempt";
import { schema } from "@/lib/db/client";
import { fakeSecretIfEnabled, resolveProvider } from "@/lib/payments";
import {
  createFakeProvider,
  makePaymentRef,
  signWebhookBody,
  SIGNATURE_HEADER,
} from "@/lib/payments/fake";
import { handlePaymentWebhook } from "@/lib/payments/webhook";
import { uid, useTestDb } from "./helpers/db";

const { companies, users, billingRecords, checkoutAttempt, paymentEvent } =
  schema;
const SECRET = "test-secret-test-secret-123456";
const provider = createFakeProvider({
  secret: SECRET,
  appUrl: "http://localhost:3000",
});
const VALID_CNPJ = "11.222.333/0001-81";

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
  vi.stubEnv("APP_URL", "http://localhost:3000");
});

const newAttempt = async (over: Record<string, unknown> = {}) => {
  const email = `buyer-${uid()}@example.test`;
  const r = await createAttempt(db, provider, {
    country: "br",
    companyName: `Acme ${uid()}`,
    taxId: VALID_CNPJ,
    billingEmail: email,
    utm: null,
    ...over,
  });
  if (!r.ok) throw new Error(`createAttempt failed: ${r.error}`);
  const [attempt] = await db
    .select()
    .from(checkoutAttempt)
    .where(eq(checkoutAttempt.id, r.attemptId));
  return { ...r, attempt, email };
};

const webhook = (
  attempt: typeof checkoutAttempt.$inferSelect,
  status: "paid" | "failed" | "expired" | "pending",
  eventId = randomUUID(),
  over: { amountCents?: number; secret?: string; badSig?: boolean } = {},
) => {
  const paymentRef = makePaymentRef(over.secret ?? SECRET, {
    attemptId: attempt.id,
    amountCents: over.amountCents ?? attempt.amountCents,
    currency: attempt.currency,
    status,
  });
  const raw = JSON.stringify({ eventId, paymentRef });
  const headers = new Headers({
    [SIGNATURE_HEADER]: over.badSig
      ? "00".repeat(32)
      : signWebhookBody(SECRET, raw),
  });
  return handlePaymentWebhook(db, provider, raw, headers);
};

const companiesFor = async (email: string) => {
  const rows = await db.select().from(users).where(eq(users.email, email));
  return rows;
};

describe("provider guard (CLAUDE.md §8)", () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
  it("defaults to none: unavailable", () => {
    expect(resolveProvider(env({})).available).toBe(false);
    expect(resolveProvider(env({ PAYMENT_PROVIDER: "none" })).available).toBe(
      false,
    );
  });
  it("fake without ALLOW_FAKE_PAYMENTS=true is unavailable and its routes' secret is null", () => {
    expect(
      resolveProvider(
        env({ PAYMENT_PROVIDER: "fake", FAKE_PAYMENTS_SECRET: SECRET }),
      ).available,
    ).toBe(false);
    expect(
      resolveProvider(
        env({
          PAYMENT_PROVIDER: "fake",
          ALLOW_FAKE_PAYMENTS: "false",
          FAKE_PAYMENTS_SECRET: SECRET,
        }),
      ).available,
    ).toBe(false);
    expect(
      fakeSecretIfEnabled(
        env({ PAYMENT_PROVIDER: "fake", FAKE_PAYMENTS_SECRET: SECRET }),
      ),
    ).toBeNull();
  });
  it("fake with the flag but no secret is unavailable", () => {
    expect(
      resolveProvider(
        env({ PAYMENT_PROVIDER: "fake", ALLOW_FAKE_PAYMENTS: "true" }),
      ).available,
    ).toBe(false);
  });
  it("ALLOW_FAKE_PAYMENTS=true without PAYMENT_PROVIDER=fake is unavailable", () => {
    expect(
      resolveProvider(
        env({ ALLOW_FAKE_PAYMENTS: "true", FAKE_PAYMENTS_SECRET: SECRET }),
      ).available,
    ).toBe(false);
  });
  it("fake with flag and secret is available", () => {
    const r = resolveProvider(
      env({
        PAYMENT_PROVIDER: "fake",
        ALLOW_FAKE_PAYMENTS: "true",
        FAKE_PAYMENTS_SECRET: SECRET,
      }),
    );
    expect(r.available && r.provider.name).toBe("fake");
    expect(
      fakeSecretIfEnabled(
        env({
          PAYMENT_PROVIDER: "fake",
          ALLOW_FAKE_PAYMENTS: "true",
          FAKE_PAYMENTS_SECRET: SECRET,
        }),
      ),
    ).toBe(SECRET);
  });
  it("mercadopago throws until phase 9b", () => {
    expect(() =>
      resolveProvider(env({ PAYMENT_PROVIDER: "mercadopago" })),
    ).toThrow(/phase 9b/);
  });
});

describe("fake provider", () => {
  it("verifyWebhook: valid signature -> event; wrong/missing signature, tampered body -> null", async () => {
    const raw = JSON.stringify({ eventId: "e1", paymentRef: "r" });
    const ok = (sig: string | null) =>
      provider.verifyWebhook(
        raw,
        new Headers(sig ? { [SIGNATURE_HEADER]: sig } : {}),
      );
    expect(await ok(signWebhookBody(SECRET, raw))).toEqual({
      eventId: "e1",
      paymentRef: "r",
    });
    expect(await ok(signWebhookBody("other-secret", raw))).toBeNull();
    expect(await ok(null)).toBeNull();
    expect(
      await provider.verifyWebhook(
        raw + " ",
        new Headers({ [SIGNATURE_HEADER]: signWebhookBody(SECRET, raw) }),
      ),
    ).toBeNull();
  });
  it("fetchPayment rejects forged, re-signed and tampered refs", async () => {
    const good = makePaymentRef(SECRET, {
      attemptId: randomUUID(),
      amountCents: 1,
      currency: "BRL",
      status: "pending",
    });
    await expect(provider.fetchPayment(good)).resolves.toMatchObject({
      status: "pending",
    });
    const [body, sig] = good.split(".");
    const flipped = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body, "base64url").toString()),
        status: "paid",
      }),
    ).toString("base64url");
    await expect(provider.fetchPayment(`${flipped}.${sig}`)).rejects.toThrow();
    await expect(
      provider.fetchPayment(
        makePaymentRef("other", {
          attemptId: "a",
          amountCents: 1,
          currency: "BRL",
          status: "paid",
        }),
      ),
    ).rejects.toThrow();
    await expect(provider.fetchPayment("garbage")).rejects.toThrow();
  });
});

describe("createAttempt", () => {
  it("refuses a country not in ENABLED_COUNTRIES (and unknown countries)", async () => {
    for (const country of ["ar", "mx", "zz", undefined]) {
      const r = await createAttempt(db, provider, {
        country,
        companyName: "Acme",
        taxId: VALID_CNPJ,
        billingEmail: `a-${uid()}@example.test`,
        utm: null,
      });
      expect(r).toEqual({ ok: false, error: "country_unavailable" });
    }
  });
  it("ar enabled but CUIT not implemented -> country_unavailable, no attempt row", async () => {
    vi.stubEnv("ENABLED_COUNTRIES", "br,ar");
    const email = `a-${uid()}@example.test`;
    const r = await createAttempt(db, provider, {
      country: "ar",
      companyName: "Acme",
      taxId: "20123456786",
      billingEmail: email,
      utm: null,
    });
    expect(r).toEqual({ ok: false, error: "country_unavailable" });
    expect(
      await db
        .select()
        .from(checkoutAttempt)
        .where(eq(checkoutAttempt.billingEmail, email)),
    ).toHaveLength(0);
  });
  it("validates name, CNPJ and email", async () => {
    const base = {
      country: "br",
      companyName: "Acme",
      taxId: VALID_CNPJ,
      billingEmail: `a-${uid()}@example.test`,
      utm: null,
    };
    expect(
      await createAttempt(db, provider, { ...base, companyName: " " }),
    ).toEqual({ ok: false, error: "invalid_name" });
    expect(
      await createAttempt(db, provider, {
        ...base,
        taxId: "11.222.333/0001-82",
      }),
    ).toEqual({ ok: false, error: "invalid_tax_id" });
    expect(
      await createAttempt(db, provider, { ...base, billingEmail: "nope" }),
    ).toEqual({ ok: false, error: "invalid_email" });
  });
  it("refuses the placeholder price for any provider other than fake", async () => {
    const real = { ...provider, name: "mercadopago" };
    const r = await createAttempt(db, real, {
      country: "br",
      companyName: "Acme",
      taxId: VALID_CNPJ,
      billingEmail: `a-${uid()}@example.test`,
      utm: null,
    });
    expect(r).toEqual({ ok: false, error: "unavailable" });
  });
  it("refuses an email that already has an account", async () => {
    const { email } = await newAttempt();
    // email only becomes an account after payment
    const a = await newAttempt();
    await webhook(a.attempt, "paid");
    const r = await createAttempt(db, provider, {
      country: "br",
      companyName: "Acme",
      taxId: VALID_CNPJ,
      billingEmail: a.email.toUpperCase(),
      utm: null,
    });
    expect(r).toEqual({ ok: false, error: "email_in_use" });
    expect(email).toBeTruthy();
  });
  it("creates a pending attempt with a signed pending ref and stores only the token hash", async () => {
    const a = await newAttempt({
      utm: { source: "google", medium: "cpc", campaign: "x" },
    });
    expect(a.attempt).toMatchObject({
      status: "pending",
      provider: "fake",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "x",
    });
    expect(a.attempt.returnTokenHash).not.toBe(a.returnToken);
    expect(a.attempt.returnTokenHash).toHaveLength(64);
    expect(a.redirectUrl).toBe(
      `http://localhost:3000/checkout/fake/${a.attemptId}`,
    );
    await expect(
      provider.fetchPayment(a.attempt.providerRef!),
    ).resolves.toMatchObject({ status: "pending", attemptId: a.attemptId });
    expect(await companiesFor(a.email)).toHaveLength(0); // creating an attempt provisions nothing
  });
});

describe("webhook -> provisioning", () => {
  it("paid: creates Company, admin User, BillingRecord (with UTM), marks the attempt paid, sends the welcome email", async () => {
    const a = await newAttempt({
      utm: { source: "google", medium: "cpc", campaign: "spring" },
    });
    const res = await webhook(a.attempt, "paid");
    expect(res).toEqual({
      status: 200,
      body: { ok: true, outcome: "provisioned" },
    });

    const [user] = await companiesFor(a.email);
    expect(user).toMatchObject({ role: "admin", email: a.email });
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, user.companyId));
    expect(company).toMatchObject({
      name: a.attempt.companyName,
      taxId: "11222333000181",
      country: "br",
    });
    const bills = await db
      .select()
      .from(billingRecords)
      .where(eq(billingRecords.companyId, company.id));
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({
      amountCents: a.attempt.amountCents,
      currency: "BRL",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "spring",
    });
    const [after] = await db
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, a.attemptId));
    expect(after).toMatchObject({ status: "paid", userId: user.id });
    expect(after.returnTokenExpiresAt).not.toBeNull();

    const files = readdirSync(outbox);
    expect(files).toHaveLength(1);
    const mail = JSON.parse(readFileSync(path.join(outbox, files[0]), "utf8"));
    expect(mail.to).toBe(a.email);
    expect(mail.text).toMatch(/http:\/\/localhost:3000\/api\/welcome\?token=/);
    expect(mail.subject).toBe("Configure sua conta"); // pt-BR for a BR company
  });

  it("replay of the same event is a no-op: still exactly one Company/User/BillingRecord/event row", async () => {
    const a = await newAttempt();
    const id = randomUUID();
    const first = await webhook(a.attempt, "paid", id);
    const second = await webhook(a.attempt, "paid", id);
    const third = await webhook(a.attempt, "paid", id);
    expect(first.body.outcome).toBe("provisioned");
    expect(second).toEqual({
      status: 200,
      body: { ok: true, outcome: "replay" },
    });
    expect(third.body.outcome).toBe("replay");
    const users_ = await companiesFor(a.email);
    expect(users_).toHaveLength(1);
    expect(
      await db
        .select()
        .from(companies)
        .where(eq(companies.taxId, "11222333000181"))
        .then((r) => r.filter((c) => c.id === users_[0].companyId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(billingRecords)
        .where(eq(billingRecords.companyId, users_[0].companyId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(paymentEvent)
        .where(eq(paymentEvent.eventKey, `fake:${id}`)),
    ).toHaveLength(1);
    expect(readdirSync(outbox)).toHaveLength(1); // one welcome email, not three
  });

  it("a DIFFERENT paid event for an already-paid attempt does not create a second Company", async () => {
    const a = await newAttempt();
    await webhook(a.attempt, "paid");
    const again = await webhook(a.attempt, "paid", randomUUID());
    expect(again.body.outcome).toBe("already_paid");
    expect(await companiesFor(a.email)).toHaveLength(1);
  });

  it("concurrent paid events for one attempt provision exactly one Company", async () => {
    const a = await newAttempt();
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(() => webhook(a.attempt, "paid", randomUUID())),
    );
    expect(
      results.filter((r) => r.body.outcome === "provisioned"),
    ).toHaveLength(1);
    expect(await companiesFor(a.email)).toHaveLength(1);
  });

  it("bad signature -> 401 and nothing provisioned", async () => {
    const a = await newAttempt();
    const res = await webhook(a.attempt, "paid", randomUUID(), {
      badSig: true,
    });
    expect(res.status).toBe(401);
    expect(await companiesFor(a.email)).toHaveLength(0);
    const [after] = await db
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, a.attemptId));
    expect(after.status).toBe("pending");
  });

  it("validly signed webhook whose 'paid' claim the processor does not confirm -> nothing provisioned", async () => {
    const a = await newAttempt();
    // webhook signature OK, but the payment ref is not one the processor vouches for
    const forged = await webhook(a.attempt, "paid", randomUUID(), {
      secret: "attacker-secret",
    });
    expect(forged.status).toBe(422);
    // and a ref the processor vouches for as merely pending
    const pending = await webhook(a.attempt, "pending");
    expect(pending.body.outcome).toBe("still_pending");
    expect(await companiesFor(a.email)).toHaveLength(0);
    const [after] = await db
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, a.attemptId));
    expect(after.status).toBe("pending");
  });

  it("amount mismatch between processor and attempt -> nothing provisioned", async () => {
    const a = await newAttempt();
    const res = await webhook(a.attempt, "paid", randomUUID(), {
      amountCents: 1,
    });
    expect(res.status).toBe(422);
    expect(await companiesFor(a.email)).toHaveLength(0);
  });

  it("unknown attempt id -> 422, nothing created", async () => {
    const a = await newAttempt();
    const res = await webhook({ ...a.attempt, id: randomUUID() }, "paid");
    expect(res.status).toBe(422);
  });

  it("failed payment: attempt -> failed, nothing provisioned, no email; a later paid event (retry at the processor) still provisions", async () => {
    const a = await newAttempt();
    expect((await webhook(a.attempt, "failed")).body.outcome).toBe(
      "marked_failed",
    );
    let [row] = await db
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, a.attemptId));
    expect(row.status).toBe("failed");
    expect(await companiesFor(a.email)).toHaveLength(0);
    expect(readdirSync(outbox)).toHaveLength(0);
    expect((await webhook(a.attempt, "paid")).body.outcome).toBe("provisioned");
    [row] = await db
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, a.attemptId));
    expect(row.status).toBe("paid");
  });

  it("expired payment -> attempt expired, nothing provisioned", async () => {
    const a = await newAttempt();
    expect((await webhook(a.attempt, "expired")).body.outcome).toBe(
      "marked_expired",
    );
    expect(await companiesFor(a.email)).toHaveLength(0);
  });

  it("a failed event never downgrades a paid attempt", async () => {
    const a = await newAttempt();
    await webhook(a.attempt, "paid");
    await webhook(a.attempt, "failed");
    const [row] = await db
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, a.attemptId));
    expect(row.status).toBe("paid");
  });

  it("email taken between attempt and payment: recorded, flagged, not provisioned twice", async () => {
    const a = await newAttempt();
    const b = await newAttempt({ billingEmail: a.email });
    await webhook(a.attempt, "paid");
    const res = await webhook(b.attempt, "paid");
    expect(res.body.outcome).toBe("email_conflict");
    const [row] = await db
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, b.attemptId));
    expect(row).toMatchObject({
      status: "failed",
      failureReason: "email_in_use_after_payment",
    });
    expect(await companiesFor(a.email)).toHaveLength(1);
  });

  it("a mail failure after commit does not undo provisioning", async () => {
    vi.stubEnv("EMAIL_DEV_SINK", "false");
    vi.stubEnv("RESEND_API_KEY", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = await newAttempt();
    const res = await webhook(a.attempt, "paid");
    expect(res.body.outcome).toBe("provisioned");
    expect(await companiesFor(a.email)).toHaveLength(1);
    spy.mockRestore();
  });
});
