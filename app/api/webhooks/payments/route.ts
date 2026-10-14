import { getDb } from "@/lib/db/client";
import { json } from "@/lib/http";
import { resolveProvider } from "@/lib/payments";
import { handlePaymentWebhook } from "@/lib/payments/webhook";

// POST /api/webhooks/payments — the same endpoint the real processor will call (phase 9b).
export async function POST(request: Request) {
  const resolution = resolveProvider();
  if (!resolution.available) return new Response("Not Found", { status: 404 });
  const raw = await request.text(); // signature is over the exact raw bytes
  const { status, body } = await handlePaymentWebhook(
    getDb(),
    resolution.provider,
    raw,
    request.headers,
  );
  return json(body, status);
}
