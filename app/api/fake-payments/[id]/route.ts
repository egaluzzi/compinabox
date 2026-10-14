import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { checkoutAttempt } from "@/lib/db/schema";
import { fakeSecretIfEnabled } from "@/lib/payments";
import {
  makePaymentRef,
  signWebhookBody,
  SIGNATURE_HEADER,
} from "@/lib/payments/fake";

// POST /api/fake-payments/<attempt id> (form: outcome=pay|fail) — what the simulator buttons call.
// Behaves like a processor: signs a webhook and POSTs it to the real endpoint. Never touches
// the DB except to read the attempt. 404 unless the fake provider is fully enabled.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const secret = fakeSecretIfEnabled();
  if (!secret) return new Response("Not Found", { status: 404 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Not Found", { status: 404 });
  const [attempt] = await getDb()
    .select()
    .from(checkoutAttempt)
    .where(eq(checkoutAttempt.id, id));
  if (!attempt || attempt.provider !== "fake")
    return new Response("Not Found", { status: 404 });

  const form = await request.formData();
  const outcome = form.get("outcome") === "pay" ? "paid" : "failed";
  const paymentRef = makePaymentRef(secret, {
    attemptId: attempt.id,
    amountCents: attempt.amountCents,
    currency: attempt.currency,
    status: outcome,
  });
  const raw = JSON.stringify({ eventId: randomUUID(), paymentRef });
  const origin = new URL(process.env.APP_URL || "http://localhost:3000").origin;
  const res = await fetch(`${origin}/api/webhooks/payments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [SIGNATURE_HEADER]: signWebhookBody(secret, raw),
    },
    body: raw,
  });
  if (!res.ok) console.error("fake processor: webhook rejected", res.status);

  // Like a real processor, send the browser back to the merchant's return URL.
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${origin}/checkout/return?attempt=${attempt.id}`,
      "Cache-Control": "no-store",
    },
  });
}
