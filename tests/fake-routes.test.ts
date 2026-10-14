// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as webhookPOST } from "@/app/api/webhooks/payments/route";
import { POST as fakePOST } from "@/app/api/fake-payments/[id]/route";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { schema } from "@/lib/db/client";
import { uid, useTestDb } from "./helpers/db";

const SECRET = "test-secret-test-secret-123456";
let db: ReturnType<typeof useTestDb>;
beforeAll(() => {
  db = useTestDb();
});
beforeEach(() => {
  vi.stubEnv("ENABLED_COUNTRIES", "br");
});

const fakeCall = (id = randomUUID()) =>
  fakePOST(
    new Request(`http://localhost/api/fake-payments/${id}`, {
      method: "POST",
      body: new URLSearchParams({ outcome: "pay" }),
    }),
    { params: Promise.resolve({ id }) },
  );
const checkoutCall = (email = `x-${uid()}@example.test`) =>
  checkoutPOST(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        country: "br",
        companyName: "Acme",
        taxId: "11222333000181",
        billingEmail: email,
      }),
    }),
  );
const webhookCall = () =>
  webhookPOST(
    new Request("http://localhost/api/webhooks/payments", {
      method: "POST",
      body: "{}",
    }),
  );

describe("with the fake provider NOT enabled, every payment route is dead", () => {
  const configs: Record<string, Record<string, string>> = {
    "nothing set (defaults)": {},
    "PAYMENT_PROVIDER=fake only": {
      PAYMENT_PROVIDER: "fake",
      FAKE_PAYMENTS_SECRET: SECRET,
    },
    "fake + ALLOW_FAKE_PAYMENTS=false": {
      PAYMENT_PROVIDER: "fake",
      ALLOW_FAKE_PAYMENTS: "false",
      FAKE_PAYMENTS_SECRET: SECRET,
    },
    "fake + flag, no secret": {
      PAYMENT_PROVIDER: "fake",
      ALLOW_FAKE_PAYMENTS: "true",
    },
  };
  for (const [label, env] of Object.entries(configs)) {
    it(`${label}: simulator and webhook 404, checkout 503 unavailable, no attempt row created`, async () => {
      for (const k of [
        "PAYMENT_PROVIDER",
        "ALLOW_FAKE_PAYMENTS",
        "FAKE_PAYMENTS_SECRET",
      ])
        vi.stubEnv(k, "");
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      const email = `dead-${uid()}@example.test`;
      expect((await fakeCall()).status).toBe(404);
      expect((await webhookCall()).status).toBe(404);
      const c = await checkoutCall(email);
      expect(c.status).toBe(503);
      expect(await c.json()).toMatchObject({ error: "unavailable" });
      expect(
        await db
          .select()
          .from(schema.checkoutAttempt)
          .where(eq(schema.checkoutAttempt.billingEmail, email)),
      ).toHaveLength(0);
    });
  }
});

describe("with the fake provider enabled", () => {
  beforeEach(() => {
    vi.stubEnv("PAYMENT_PROVIDER", "fake");
    vi.stubEnv("ALLOW_FAKE_PAYMENTS", "true");
    vi.stubEnv("FAKE_PAYMENTS_SECRET", SECRET);
    vi.stubEnv("APP_URL", "http://localhost:3000");
  });
  it("webhook without a signature -> 401; simulator for an unknown attempt -> 404", async () => {
    expect((await webhookCall()).status).toBe(401);
    expect((await fakeCall()).status).toBe(404);
  });
  it("checkout sets an httpOnly return_token cookie and returns the hosted-checkout URL", async () => {
    const res = await checkoutCall();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirectUrl).toMatch(/\/checkout\/fake\/[0-9a-f-]{36}$/);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^return_token=[\w-]{40,}/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax".replace("l", "L"));
  });
  it("checkout rejects bad input in-band with a code", async () => {
    const res = await checkoutPOST(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          country: "br",
          companyName: "Acme",
          taxId: "123",
          billingEmail: "a@b.test",
        }),
      }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_tax_id" });
    expect(
      (
        await checkoutPOST(
          new Request("http://localhost/api/checkout", {
            method: "POST",
            body: "not json",
          }),
        )
      ).status,
    ).toBe(400);
  });
});
