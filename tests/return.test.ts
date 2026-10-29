// @vitest-environment node
import { GET as statusGET } from "@/app/api/checkout/status/route";
import { TERMS_VERSION } from "@/lib/legal/version";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAttempt } from "@/lib/checkout/attempt";
import { readReturnState } from "@/lib/checkout/return";
import { schema } from "@/lib/db/client";
import {
  createFakeProvider,
  makePaymentRef,
  signWebhookBody,
  SIGNATURE_HEADER,
} from "@/lib/payments/fake";
import { handlePaymentWebhook } from "@/lib/payments/webhook";
import { uid, useTestDb } from "./helpers/db";

const { checkoutAttempt } = schema;
const SECRET = "test-secret-test-secret-123456";
const provider = createFakeProvider({
  secret: SECRET,
  appUrl: "http://localhost:3000",
});
let db: ReturnType<typeof useTestDb>;
beforeAll(() => {
  db = useTestDb();
});
beforeEach(() => {
  vi.stubEnv("ENABLED_COUNTRIES", "br");
  vi.stubEnv("EMAIL_DEV_SINK", "true");
  vi.stubEnv("EMAIL_SINK_DIR", `/tmp/return-test-outbox-${uid()}`);
});

async function paidAttempt() {
  const r = await createAttempt(db, provider, {
    country: "br",
    companyName: "Acme",
    taxId: "11222333000181",
    billingEmail: `r-${uid()}@example.test`,
    utm: null,
    termsAccepted: true,
    termsVersion: TERMS_VERSION,
  });
  if (!r.ok) throw new Error(r.error);
  const [attempt] = await db
    .select()
    .from(checkoutAttempt)
    .where(eq(checkoutAttempt.id, r.attemptId));
  return { ...r, attempt };
}
async function pay(
  attempt: typeof checkoutAttempt.$inferSelect,
  now = new Date(),
) {
  const raw = JSON.stringify({
    eventId: randomUUID(),
    paymentRef: makePaymentRef(SECRET, {
      attemptId: attempt.id,
      amountCents: attempt.amountCents,
      currency: attempt.currency,
      status: "paid",
    }),
  });
  await handlePaymentWebhook(
    db,
    provider,
    raw,
    new Headers({ [SIGNATURE_HEADER]: signWebhookBody(SECRET, raw) }),
    "http://localhost/api/webhooks/payments",
    now,
  );
}

describe("return page state / post-payment session", () => {
  it("pending attempt: status pending, never a user, and polling provisions nothing", async () => {
    const a = await paidAttempt();
    const s = await readReturnState(db, a.attemptId, a.returnToken);
    expect(s).toEqual({ status: "pending", user: null });
    const [row] = await db
      .select()
      .from(checkoutAttempt)
      .where(eq(checkoutAttempt.id, a.attemptId));
    expect(row.status).toBe("pending");
    expect(row.userId).toBeNull();
  });

  it("paid + matching token -> user, exactly once (reuse -> no session)", async () => {
    const a = await paidAttempt();
    await pay(a.attempt);
    const first = await readReturnState(db, a.attemptId, a.returnToken);
    expect(first.status).toBe("paid");
    expect(first.user?.email).toBe(a.attempt.billingEmail);
    const again = await readReturnState(db, a.attemptId, a.returnToken);
    expect(again).toEqual({ status: "paid", user: null });
  });

  it("paid + absent token -> status only", async () => {
    const a = await paidAttempt();
    await pay(a.attempt);
    expect(await readReturnState(db, a.attemptId, undefined)).toEqual({
      status: "paid",
      user: null,
    });
    expect(await readReturnState(db, a.attemptId, "")).toEqual({
      status: "paid",
      user: null,
    });
  });

  it("paid + wrong token (another browser, or another attempt's token) -> no session, and the right token still works afterwards", async () => {
    const a = await paidAttempt();
    const other = await paidAttempt();
    await pay(a.attempt);
    expect((await readReturnState(db, a.attemptId, "wrong")).user).toBeNull();
    expect(
      (await readReturnState(db, a.attemptId, other.returnToken)).user,
    ).toBeNull();
    expect(
      (await readReturnState(db, a.attemptId, a.returnToken)).user,
    ).not.toBeNull();
  });

  it("paid + expired token (1 h after payment) -> no session", async () => {
    const a = await paidAttempt();
    await pay(a.attempt, new Date(Date.now() - 61 * 60 * 1000)); // paid 61 min ago -> token expired 1 min ago
    expect(await readReturnState(db, a.attemptId, a.returnToken)).toEqual({
      status: "paid",
      user: null,
    });
  });

  it("failed attempt never yields a session", async () => {
    const a = await paidAttempt();
    await db
      .update(checkoutAttempt)
      .set({ status: "failed" })
      .where(eq(checkoutAttempt.id, a.attemptId));
    expect(await readReturnState(db, a.attemptId, a.returnToken)).toEqual({
      status: "failed",
      user: null,
    });
  });

  it("unknown / malformed attempt ids", async () => {
    expect((await readReturnState(db, randomUUID(), "x")).status).toBe(
      "unknown",
    );
    expect((await readReturnState(db, "not-a-uuid", "x")).status).toBe(
      "unknown",
    );
  });
});

describe("GET /api/checkout/status: amount for the conversion event", () => {
  const call = (id: string, token?: string) =>
    statusGET(
      new Request(`http://localhost/api/checkout/status?attempt=${id}`, {
        headers: token ? { cookie: `return_token=${token}` } : {},
      }),
    );
  it("pending: no amount; paid: amountCents + currency and nothing identifying", async () => {
    const a = await paidAttempt();
    const pending = await (await call(a.attemptId)).json();
    expect(pending).toEqual({
      status: "pending",
      country: "br",
      signedIn: false,
    });
    await pay(a.attempt);
    const paid = await (await call(a.attemptId)).json();
    expect(paid).toEqual({
      status: "paid",
      country: "br",
      signedIn: false,
      amountCents: a.attempt.amountCents,
      currency: a.attempt.currency,
    });
  });
});
