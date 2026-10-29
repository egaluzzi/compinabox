import { getDb } from "@/lib/db/client";
import { json } from "@/lib/http";
import { resolveProvider } from "@/lib/payments";
import {
  reconcilePending,
  reconcileTokenValid,
} from "@/lib/payments/reconcile";

// POST /api/internal/reconcile-payments — called every 10 minutes by scripts/reconcile-payments.mjs
// (systemd timer) on the same server. Authenticated with a bearer derived from the webhook secret;
// anything else is a 404 so the route does not advertise itself.
export async function POST(request: Request) {
  const resolution = resolveProvider();
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";
  const bearer = (request.headers.get("authorization") ?? "").replace(
    /^Bearer /,
    "",
  );
  if (
    !resolution.available ||
    resolution.provider.name !== "mercadopago" ||
    !reconcileTokenValid(bearer, secret)
  )
    return new Response("Not Found", { status: 404 });
  const summary = await reconcilePending(getDb(), resolution.provider);
  return json({ ok: true, ...summary });
}
