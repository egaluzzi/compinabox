// reconcile-payments.mjs — re-checks stale pending Mercado Pago payments (systemd timer
// complystart-reconcile.timer, every 10 minutes). It does NOT touch the database: it asks the
// running app to do it, so the webhook and this job share one code path (lib/payments/reconcile.ts).
// Prints counts only. Does nothing (exit 0) unless PAYMENT_PROVIDER=mercadopago.
//
//   node scripts/reconcile-payments.mjs
import { createHmac } from "node:crypto";

if (
  (process.env.PAYMENT_PROVIDER ?? "").trim().toLowerCase() !== "mercadopago"
) {
  console.log("reconcile: PAYMENT_PROVIDER is not mercadopago; nothing to do");
  process.exit(0);
}
const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";
if (!secret || /changeme/i.test(secret)) {
  console.error("reconcile: MERCADOPAGO_WEBHOOK_SECRET is not set");
  process.exit(1);
}
const host = process.env.HOSTNAME || "127.0.0.1";
const port = process.env.PORT || "3000";
const token = createHmac("sha256", secret)
  .update("reconcile-payments")
  .digest("hex");
try {
  const res = await fetch(
    `http://${host}:${port}/api/internal/reconcile-payments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(120_000),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`reconcile failed (HTTP ${res.status})`);
    process.exit(1);
  }
  console.log(
    `reconcile: checked ${body.checked} changed ${body.changed} unavailable ${body.unavailable} errors ${body.errors}`,
  );
  if (body.errors > 0) process.exitCode = 1;
} catch (err) {
  console.error(`reconcile failed (${err && err.name ? err.name : "error"})`);
  process.exit(1);
}
