# Supervisor notes — worker task: Phase 9b (Mercado Pago payment provider)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of your
session before anything else. Branch `phase-9b-mercadopago` from `main`. Report in `HANDOFF.md`.

---

## If this is a WORKER task

### Context
Phases 0-9c are merged. Checkout, provisioning, the idempotency ledger and the webhook endpoint exist
and are tested against the guarded `fake` provider (`lib/payments/*`, `lib/checkout/*`,
`app/api/webhooks/payments/route.ts`). `resolveProvider()` currently throws for
`PAYMENT_PROVIDER=mercadopago`. This phase adds the real provider. **Deep review: this is money.**
Read first: `CLAUDE.md` (§0, §8, §9 payments / fake payments / environments), the **Phase 9b** section
of `IMPLEMENTATION_PLAN.md`, and `lib/payments/{types,index,webhook,fake}.ts`.

Mercado Pago (MP) facts below come from the supervisor's memory and **may be out of date**. Before
coding, read MP's current official developer documentation (Checkout Pro preferences, Webhooks /
`x-signature`, Payments API, Pix, refunds / chargebacks, test credentials and test users) and cite the
pages you relied on in `HANDOFF.md`. Where the docs disagree with these notes, follow the docs and say so.
Do not use an MP SDK: plain `fetch` (fewer dependencies — CLAUDE.md §0). No new dependency.

### UPDATE 2026-10-29 (Esteban): no Mercado Pago account yet
Esteban has no MP credentials yet and says: **keep the dummy payment page** (the guarded `fake` provider's
simulator at `/checkout/fake/<id>`) until MP is set up. So for this session:
- **Assume the sandbox credentials and network access are absent.** Do not wait for them. Build everything below,
  test with fixtures labelled "hand-written from the docs, not recorded", and in `HANDOFF.md` state that the sandbox
  round-trip is **not done and the phase cannot be accepted**, listing exactly what Esteban must provide (see "Verification").
  If you find the credentials and network access *are* present after all, do the real round-trip as written.
- Staging stays on `PAYMENT_PROVIDER=fake`; the fake provider, its simulator page and all phase-2 tests must keep
  working unchanged in behaviour. `PAYMENT_PROVIDER=mercadopago` without credentials must simply report checkout
  unavailable (item 5). Nothing here may change what a staging visitor sees today.
- Your docs reading needs the web: if `www.mercadopago.com.br` / `developers` pages are unreachable, say so,
  work from the supervisor's description, mark every API detail "unverified against current docs" in the code
  comments and the handoff, and do not guess field names silently.

### What to build

1. **`lib/payments/mercadopago.ts` — `MercadoPagoProvider`** implementing `PaymentProvider`.
   - `createCheckout`: create a Checkout Pro **preference**: `external_reference = attempt.id`;
     one item (title from a neutral product name, quantity 1, `currency_id` BRL, `unit_price` from
     `amountCents` using **integer math, never floating-point accumulation** — test 1000 → `10.00`,
     1 → `0.01`, 12345 → `123.45`); `payer.email` = billing email; `notification_url` =
     `${APP_URL origin}/api/webhooks/payments` (https only; refuse to create a preference in
     production if it is not https); `back_urls` + `auto_return: "approved"` pointing at the existing
     `/checkout/return` page. **Send an idempotency header** (the attempt id) so a retried request does
     not create a second preference. Pix must be available; **exclude boleto** (`payment_types`
     `ticket`) — its multi-day pending state is out of scope. Record both as Judgment calls for
     Esteban. Return the preference's checkout URL as `redirectUrl` (the sandbox URL in sandbox mode)
     and the preference id as `providerRef`.
   - `verifyWebhook(rawBody, headers, url)`: **the interface must change** — MP signs a manifest built
     from the `data.id` query parameter, the `x-request-id` header and the `ts` in `x-signature`
     (`ts=…,v1=…`), HMAC-SHA256 with `MERCADOPAGO_WEBHOOK_SECRET`. Add the request URL (or its
     search params) as a third argument to `PaymentProvider.verifyWebhook`, update the fake provider
     and the route, keep all phase-2 tests green. Constant-time compare. Missing/garbled header,
     missing secret, wrong signature → `null` (the route answers 401, nothing is read from the body).
     Only `type=payment` notifications become events; anything else (merchant orders, etc.) is
     verified and then acknowledged with 200 and ignored — never a 5xx that makes MP retry forever.
     The event id is the **payment id** (so a redelivery is a replay), the `paymentRef` is the payment id.
     Do not add a timestamp-tolerance window (MP retries later with new timestamps); idempotency +
     re-fetch is the protection. Say so in a comment.
   - `fetchPayment(paymentRef)`: `GET /v1/payments/{id}` with the access token, with a timeout
     (`AbortSignal`, ~8 s) and **no secrets in error messages or logs**. Map: 404 or a body with no
     `external_reference` → `PaymentNotFound`; network error, timeout, 5xx, 429 →
     `PaymentLookupUnavailable` (route returns 503 so MP retries). Map status: `approved` → `paid`;
     `pending`, `in_process`, `in_mediation`, `authorized` → `pending`; `rejected` → `failed`;
     `cancelled` → `failed`; expired (check the docs: Pix expiry shows as `expired`/`cancelled` with a
     detail) → `expired`; `refunded`, `charged_back` → new statuses (below). Amount: convert
     `transaction_amount` to cents with **rounding done on the decimal string, not float math**, and
     compare to the stored amount in the existing mismatch check. `currency_id` must match.
     `attemptId` = `external_reference`. **Live/sandbox safety:** MP payments carry a `live_mode`
     flag. Construct the provider with `expectLive = (APP_ENV === "production")`; a payment whose
     `live_mode` does not match → `PaymentNotFound`. This stops real money flowing into staging
     (fictitious data) and sandbox payments provisioning production accounts. If the docs show `live_mode`
     is unreliable, find the documented equivalent and say what you used.
2. **Refunds and chargebacks.** Extend `PaymentStatus` with `refunded` and `charged_back`. The webhook
   core (`lib/payments/webhook.ts`) handles them for an attempt that is already `paid`: set
   `billing_records.refunded_at` (new nullable column, **migration 0009**, `drizzle-kit generate`;
   append-only discipline: never delete the Company, never change documents, **do not suspend or
   lock the account** — that is a business decision for Esteban; record "no access change on refund" as
   a judgment call) and send an ops alert. Partial refunds: treat only a full refund / chargeback as
   `refunded`; a partial one is logged and alerted but changes nothing. Use the idempotency ledger so a
   replayed refund notification does nothing the second time (event key must distinguish status:
   `mercadopago:<paymentId>:refunded`, and keep `…:approved` for paid so existing replay logic holds).
3. **Ops alerts.** New env `OPS_ALERT_EMAIL`. When (a) a payment is `PAID BUT NOT PROVISIONED`
   (`email_in_use_after_payment`), (b) an amount/currency `mismatch` or `unknown_attempt` arrives for a
   **verified** webhook, or (c) a refund/chargeback arrives, send a plain e-mail through the existing
   `getEmailSender()` to that address (subject says what happened; body has attempt id, payment id,
   amount, **no personal data beyond the attempt id and payment id**). A failure to send is logged and
   never changes the webhook response. Unset → log only (staging). Never alert from an
   unverified webhook (no spam vector).
4. **Reconciliation** (webhooks do get lost; Pix pending → approved can arrive hours later).
   `scripts/reconcile-payments.mjs` (shipped in releases like `maintenance.mjs`; add a systemd
   timer next to the existing maintenance timer in `ops/systemd/`, every 10 minutes): for attempts
   still `pending`, older than 5 minutes and younger than 7 days, with provider `mercadopago`, find
   the payment **by `external_reference` via MP's payment search API**, then run the **same** code path
   as the webhook (refactor `handlePaymentWebhook` into a shared function that takes a verified
   `PaymentInfo`+event; the webhook and the reconciler both call it; no duplicated provisioning
   logic). The browser return URL still never marks anything paid. Bounded: max 50 attempts per run,
   sequential, per-item error isolation.
5. **`resolveProvider`**: `PAYMENT_PROVIDER=mercadopago` requires `MERCADOPAGO_ACCESS_TOKEN` and
   `MERCADOPAGO_WEBHOOK_SECRET` (`MERCADOPAGO_PUBLIC_KEY` only if the hosted flow needs it — say
   whether it does); if anything is missing → `{ available: false }` (checkout unavailable) with a
   clear log line, **not** a throw. Fake routes still 404 unless fake is enabled.
6. **Environment guard** (`lib/env.ts`, extend `checkEnvironment`): in **production**,
   `PAYMENT_PROVIDER=mercadopago` ⇒ `MERCADOPAGO_ACCESS_TOKEN` and `MERCADOPAGO_WEBHOOK_SECRET` present and
   not `changeme`; `PAYMENT_PROVIDER=none` stays legal (site without checkout). The existing fake-payments
   rules stay. `lib/pricing.ts`: a placeholder price (`isPlaceholder`) must never be charged through
   MP **in production** (refuse at checkout with a clear error); with a sandbox credential on staging it is
   allowed (that is how you test). Add tests.
7. **Staging/ops files:** `.env.example` and `README` list the new keys (`OPS_ALERT_EMAIL`,
   `MERCADOPAGO_*`, plus how Esteban creates a sandbox seller/buyer test user and finds the three
   values — written for a non-engineer, in the README's existing "Staging server setup" style). Do **not**
   write MP values into `ops/bootstrap-server.sh` defaults; staging keeps `PAYMENT_PROVIDER=fake` until
   Esteban chooses to switch it.
8. **Logging/privacy:** never log the access token, the webhook secret, payer e-mail or card data;
   redact them in errors. Caddy already redacts paths; confirm the webhook path logs no query string
   containing `data.id` beyond what is harmless (payment ids are not secrets, say what you decided).
9. **Deploy note:** MP will only call an https URL with a certificate it trusts. Staging is a bare IP with
   Caddy's self-made certificate, so **MP cannot deliver webhooks to staging** (probably; check the
   docs). Do not work around that with a tunnel or new service. See "Verification" for how the proof is
   split.

### Verification — what counts (read carefully; this is the phase's whole difficulty)
Mock-only is **not verified** for this phase. You need sandbox credentials from Esteban
(`MERCADOPAGO_ACCESS_TOKEN` of a **test** seller, the test buyer's details, the webhook secret of a test
application) and network access to `api.mercadopago.com`, `www.mercadopago.com.br`, `www.mercadopago.com`
(environment settings: Edit → Network access → Allowed domains; credentials as environment secrets).
**First action of the session:** check whether the credentials are present
(`[ -n "$MERCADOPAGO_ACCESS_TOKEN" ]`, never print them) and whether `api.mercadopago.com` is reachable. Then:

- **If both are present:** run a real sandbox round-trip and paste the evidence (redacted): create a
  preference (real API response ids); create sandbox payments with the documented test cards through
  the API to obtain real `approved` and `rejected` payments with your `external_reference`; fetch them
  through `fetchPayment`; run the reconciler against them end to end on a real Postgres:
  approved → one Company/User/BillingRecord + welcome e-mail in the outbox; same payment fed twice →
  still exactly one Company; rejected → attempt `failed`, no Company, user can retry; pending (a Pix
  payment created in sandbox, if the sandbox allows) → stays pending then is picked up when approved;
  a refund of an approved sandbox payment through the API → `refunded_at` set, alert sent.
- **Webhook signature:** MP can only deliver to a public https address. Deliver a **hand-built** request
  signed per MP's documented manifest with the real test application secret, as a unit/route test **and**
  state plainly that the algorithm is unproven against a real MP delivery until one happens (MP's
  dashboard can "simulate" a notification — Esteban does that after a domain exists, Phase 9d). Write that
  into `IMPLEMENTATION_PLAN.md`'s 9b checklist as an open gate rather than ticking it.
- **If the credentials or network access are missing:** do not fake it. Build everything, test with
  fixtures that you label **"hand-written from the docs, not recorded"**, state in `HANDOFF.md` that the
  sandbox round-trip is **not done and the phase cannot be accepted**, list exactly what you need from
  Esteban, and stop. Never commit a recorded response containing a token, e-mail or card number; fixtures
  that are recorded must be redacted.
- Tests (real Postgres): every status mapping; signature valid / wrong / missing header / garbled
  `ts` / altered `data.id` / altered request-id / empty secret; non-payment notification → 200 ignored;
  verified webhook for an unknown attempt → 422 + alert; amount mismatch → nothing provisioned + alert;
  `live_mode` mismatch both ways; timeout and 5xx → 503; replay of paid and of refunded; concurrent
  duplicate deliveries (two at once → one Company); reconciler idempotent and bounded; production guard
  cases; placeholder price refused in production; `unit_price` conversion cases.

### Guardrails for this phase (a violation means stop and write "blocked")
- No credential, token, secret, real e-mail or card number in the repo, fixtures, logs, screenshots
  or `HANDOFF.md`.
- The webhook and the reconciler are the only things that mark an attempt paid. Never the browser return
  URL, never a body field.
- No change to what is logged or retained beyond the above, no auto-suspension of accounts, no new
  paid service, no new dependency.
- Fake payments stay guarded exactly as today; production still refuses them.
- Do not touch legal content, documents, or the whistleblower/vendor/binder code.
- Production keys or live payments: never. Sandbox only. The one real low-value payment is Esteban's.

### Definition of done (paste in `HANDOFF.md`)
- `./verify.sh` exit 0 (unedited extract: commit state, counts, build, smoke, drift, forbidden claims).
- The sandbox evidence above (or the explicit "not done" statement).
- The migration (0009): `drizzle-kit generate` → "No schema changes" afterwards.
- A list of every MP doc page used, every place the docs disagreed with these notes, and the Judgment
  calls (boleto excluded, installments left at MP default or limited — say which; Pix expiry handling;
  partial refunds; no account suspension).
- CI green on the PR head (opened by you; do not merge).

### Order of work
1. Check credentials/network (above). Read the docs.
2. Interface change (`verifyWebhook` third arg) + shared processing function, with the phase-2 suite green.
3. `mercadopago.ts` + tests; statuses; migration 0009; refund handling; alerts.
4. Guard/pricing rules; `resolveProvider`.
5. Reconciler + timer; README/`.env.example`.
6. Sandbox round-trip; `verify.sh`; handoff; PR.

---

## If this is a VERIFIER task
Not used for this phase unless the supervisor writes a claim here.
