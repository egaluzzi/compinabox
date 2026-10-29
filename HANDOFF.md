# HANDOFF — Phase 9b (Mercado Pago provider)

**Status: code complete, `verify.sh` green — but the phase CANNOT BE ACCEPTED.** The sandbox round-trip was **not done**: no
Mercado Pago (MP) credentials and no network path to MP in this session (`MERCADOPAGO_ACCESS_TOKEN` unset; `api.mercadopago.com`
and `www.mercadopago.com.br` unreachable — curl returned no HTTP status). Per the UPDATE 2026-10-29 in SUPERVISOR_NOTES.md the
fake provider and its simulator are untouched in behaviour and staging stays on `PAYMENT_PROVIDER=fake`.

## MP documentation: NOT read
The MP developer pages were unreachable, so **every MP API detail is "unverified against current docs"** (also marked UNVERIFIED in
`lib/payments/mercadopago.ts`). Doc pages used: none. Disagreements between docs and notes: none found (nothing was compared).
Details taken from the supervisor notes/memory and needing a docs check: `POST /checkout/preferences` fields and
`init_point`/`sandbox_init_point`; `X-Idempotency-Key`; `x-signature` manifest `id:<data.id lower>;request-id:<x-request-id>;ts:<ts>;`
(parts left out when absent); `GET /v1/payments/{id}` fields (`external_reference`, `transaction_amount`,
`transaction_amount_refunded`, `currency_id`, `live_mode`, `status`, `status_detail`); `GET /v1/payments/search?external_reference=`;
Pix expiry = `cancelled` + `status_detail: expired`; `back_urls`/`auto_return`; whether MP delivers to a bare IP with a self-made cert
(assumed not). Fixtures in `tests/mercadopago.test.ts` are **hand-written from the notes, not recorded**.

## What was built
- `lib/payments/mercadopago.ts`: `createMercadoPagoProvider` (plain `fetch`, no dependency). Preference (external_reference = attempt id, BRL,
  `unit_price` by integer math: 1000→10.00, 1→0.01, 12345→123.45, idempotency header = attempt id, Pix kept, `ticket` excluded, https
  `notification_url`, `back_urls` → `/checkout/return?attempt=<id>`, sandbox URL when not production; refuses non-https in production).
  `verifyWebhook` (constant-time HMAC; missing/garbled header, empty secret, altered id/request-id → null; authentic non-payment → `{ignored:true}`
  → 200; event id = payment id; **no timestamp window**, deliberately — idempotency + re-fetch protect). `fetchPayment` (8 s timeout; 404/no
  `external_reference`/`live_mode` mismatch (also missing flag, fail-closed) → `PaymentNotFound`; network/timeout/5xx/429 → `PaymentLookupUnavailable`; amount
  rounded half-up on the decimal string; no token/body in errors). `findPayments` for reconciliation.
- Interface: `verifyWebhook(rawBody, headers, url)`; `WebhookVerification`; `PaymentStatus` + `refunded`/`charged_back`; `PaymentInfo.ledgerStatus`/`refundedCents`.
- `lib/payments/webhook.ts` refactored: `handlePaymentWebhook` → `processPaymentEvent` → **`applyPayment`** (the only place an attempt becomes paid/failed/refunded;
  the reconciler calls it too). Ledger keys: `mercadopago:<paymentId>:approved` / `:refunded` / `:charged_back` / `:partial_refund_<cents>`; fake keys unchanged.
- Refund/chargeback: `billing_records.refunded_at` (**migration 0009_billing_refunded_at**; `drizzle-kit generate` afterwards: "No schema changes"). Company, documents
  untouched; no suspension. Partial refund: alert only. Replays do nothing.
- `lib/payments/alerts.ts` + `OPS_ALERT_EMAIL`: alerts for paid-but-not-provisioned, unknown attempt, mismatch, refund, chargeback, partial refund — verified webhooks only;
  body = attempt id, payment id, cents, currency (tested: no e-mail/company name). Send failure is logged, never changes the response; unset = log only.
- Reconciler: `lib/payments/reconcile.ts`, `scripts/reconcile-payments.mjs`, `ops/systemd/complystart-reconcile.{service,timer}` (every 10 min, wired into
  `bootstrap-server.sh` and `package-release.sh`). Pending attempts 5 min–7 days, max 50 per run, sequential, per-item isolation.
- `resolveProvider`: `mercadopago` without both secrets (or `changeme`) → `{available:false}` + log line, no throw. `MERCADOPAGO_PUBLIC_KEY` is **not needed** (hosted flow).
- `checkEnvironment`: production + `mercadopago` ⇒ token and webhook secret present, not `changeme`; `none` stays legal. Placeholder price: refused for mercadopago in production, allowed otherwise.
- README ("Later: Mercado Pago sandbox", non-engineer steps) and `.env.example` updated. `bootstrap-server.sh` defaults untouched (staging stays `fake`).
- Logging: Caddy already strips query strings from logged URLs, so `data.id` is never logged; payment ids are not secrets anyway.

## Judgment calls
1. **Reconciler runs inside the app, not as a DB script.** `applyPayment` is TypeScript in the Next build and the shipped `scripts/*.mjs` only have `pg`; so the timer script POSTs to
   `/api/internal/reconcile-payments` on `127.0.0.1:$PORT`. Auth = bearer HMAC derived from `MERCADOPAGO_WEBHOOK_SECRET` (no new env var); any other caller gets 404. The script is a no-op (exit 0) unless `PAYMENT_PROVIDER=mercadopago`, so the timer is harmless on staging.
2. Boleto excluded; Pix allowed; installments left at MP's default.
3. Pix expiry = `cancelled`+`status_detail: expired` → attempt `expired` (UNVERIFIED).
4. Partial refund → alert only (once per refunded amount). No account suspension on refund/chargeback ("no access change on refund" — Esteban's later call).
5. Unknown MP status → treated as `pending` (provisions nothing). `live_mode` absent → rejected (fail closed).
6. An attempt marked `failed` by a rejected payment is not re-polled by the reconciler (only `pending` is, per the notes); a later approval for it still arrives via webhook and provisions.
7. A verified webhook that gets a 422 (unknown/mismatch) is retried by MP, so it can repeat the ops alert; accepted (bounded, verified-only).
8. The existing test "refuses the placeholder price for any provider other than fake" now sets `APP_ENV=production` (rule is production-only for MP, per the notes).

## Evidence
`./verify.sh` (run at commit fac889a; this HANDOFF is the only later change) — exit 0:
```
fresh database / db:migrate   ok (from scratch), 22 tables
lint ok · typecheck ok · build ok · smoke: PASS
tests: Test Files 57 passed (57) · Tests 901 passed (901) · counts total=901 pass=901 fail=0 skip=0
migration drift: schema changed, migration present · tenant isolation ok · forbidden claims none · secrets none found
verify.sh: PASS (HEAD fac889a)
```
New tests (real Postgres): `tests/mercadopago.test.ts` (35: amount conversion, preference body, every status, signature cases, live_mode both ways, timeout/5xx/429 → 503,
replay of paid and refunded, concurrent duplicate deliveries → one Company, forged → 401, ignored notifications, mismatch/unknown + alerts, paid-but-not-provisioned alert,
partial/full refund/chargeback, reconciler idempotent/bounded/age window, resolveProvider, placeholder price), `tests/reconcile-route.test.ts`, 3 production-guard cases in `tests/env-guard.test.ts`.

## NOT done — what Esteban must provide (see README "Later: Mercado Pago sandbox")
1. An MP account with a test **seller** and **buyer**; the seller's `MERCADOPAGO_ACCESS_TOKEN`, the test application's webhook secret → `MERCADOPAGO_WEBHOOK_SECRET`, as environment secrets (never in chat/repo).
2. Worker network settings: allow `api.mercadopago.com`, `www.mercadopago.com.br`, `www.mercadopago.com`.
3. `OPS_ALERT_EMAIL`.
Then a worker must: read the MP docs and correct every UNVERIFIED item; run the real sandbox round-trip (preference, approved + rejected payments, Pix if possible, refund, reconciler end to end);
re-label or replace the fixtures. Open gate (unticked in IMPLEMENTATION_PLAN): `x-signature` against a real MP delivery, possible only with a domain + valid certificate (Phase 9d).
Boxes in the plan's 9b checklist are deliberately left unticked.
