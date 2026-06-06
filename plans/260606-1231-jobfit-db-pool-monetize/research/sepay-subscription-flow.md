# Research R2 — SePay (VietQR) subscription flow

**Date:** 2026-06-06
**For:** plan `260606-1231-jobfit-db-pool-monetize`
**Sources:** `.claude/skills/payment-integration/references/sepay/*` (overview, webhooks, qr-codes, best-practices).

---

## Reality check: SePay is bank-transfer, not card subscription

SePay does NOT have a hosted recurring-billing primitive like Stripe Subscriptions. The "subscription" pattern is a **renewal-by-transfer** model:

- User initiates "Upgrade" → app mints an order → renders VietQR for current month's price
- User scans → bank app transfers VND with order-id in the memo
- SePay webhook fires → app verifies → flips `subscriptions.status='active'` with `current_period_end = now + 30d`
- 3 days before period end → app emails "renew now" with new QR
- If no transfer by `current_period_end` → status flips to `expired` via cron (or lazy check on next recommend call)

This is **acceptable** for the VN market — bank-transfer is the dominant payment UX. Trade-off: no auto-renewal, manual re-scan each cycle.

## Concrete flow

```
1. UI: /upgrade page → POST /api/checkout/sepay {plan: 'monthly'}
2. Server:
   - Insert orders {id=uuid, userId, amount=PRICE_VND, status='pending', paymentId='RR ' + uuid}
   - Build QR URL: https://qr.sepay.vn/img?acc={SEPAY_ACCOUNT_NUMBER}&bank={SEPAY_BANK_NAME}&amount={amount}&des=RR+{uuid}
   - Return { orderId, qrUrl, amountVnd, content }
3. UI: poll GET /api/orders/{id}/status every 3s until status='completed' (max 10 min)
4. Bank transfer happens; SePay webhook POSTs to /api/webhooks/sepay
5. Webhook handler:
   - Auth: timing-safe compare Authorization header against SEPAY_WEBHOOK_API_KEY
   - Idempotency: INSERT INTO sepay_webhook_events ON CONFLICT (event_id) DO NOTHING
   - Match order via parseOrderIdFromContent(content) — fallback strategies in best-practices.md
   - Verify amount >= order.amount
   - UPDATE orders SET status='completed', paid_at=now, match_method=...
   - UPSERT subscriptions {userId, status='active', current_period_start=now,
        current_period_end=now+30d, sepay_order_id=order.id}
   - UPDATE users SET plan='paid'
   - Return 200 {success:true} (always — never error to SePay)
6. UI long-poll catches the flip → redirects to /job-fit with "Paid" badge
```

## Pricing decision (default; flag in open questions)

| Plan | Price (VND) | USD ~equiv | Notes |
|---|---|---|---|
| Free | 0 | 0 | Default. 1-2 tier-B jobs per refresh. |
| Paid (monthly) | **99,000 VND** | ~$4 USD | 5-10 jobs incl. tier S/A. |

Rationale: 99K is the VN SaaS sweet-spot for prosumer tools. Half of Spotify VN. User can override.

## Content format

Use `RR {orderId}` (RR = ResumeRefine). Short, unique, parser-friendly. Memo limits on VN banks are ~50 chars; UUID + prefix = 40 chars, safe.

Bank transformations to handle (per best-practices.md):
- Dash-stripping: `RR 4e4635f404784080a5c548da91f97f1e`
- Case folding: `rr {uuid}`, `RR{uuid}`
- Prefix wrap: `BankAPINotify RR {uuid}-CHUYEN TIEN`

Adopt the `normalizeUUID` helper from the skill ref verbatim.

## Required env vars

```
SEPAY_WEBHOOK_API_KEY=<from SePay dashboard>
SEPAY_ACCOUNT_NUMBER=<bank account>
SEPAY_ACCOUNT_NAME=RESUMEREFINE
SEPAY_BANK_NAME=Vietcombank   # or whichever bank operator picks
PAID_PLAN_PRICE_VND=99000
```

All scopes: production (per project memory `feedback_single_env_production_only`). No dev/preview separation.

## Webhook security

- Auth: `Authorization: Apikey <key>` — timing-safe compare to env var.
- Idempotency: `sepay_webhook_events.event_id = payload.id` (SePay transaction id, unique).
- Always return 200 to prevent SePay 7-retry storm.
- IP whitelisting (defer — SePay does not publish stable IP list).

## Cost-guard bucket

Add `'sepay-webhook'` bucket to `src/lib/cost/buckets.ts`. Even though webhook itself has no LLM cost, instrument it for rate-limit detection (DDoS / replay). Soft cap: 1000 req/day; alert at 80%.

## Subscription expiry

Two strategies (pick one in plan):

**Strategy A — Lazy (recommended):**
- On every recommend call, check `subscriptions WHERE userId = $1 AND status = 'active' AND current_period_end > now()`.
- If no active sub → user is treated as `free` tier.
- Nightly cron tags expired rows: `UPDATE subscriptions SET status='expired' WHERE current_period_end < now() AND status='active'` (cosmetic for admin UI).

**Strategy B — Eager cron:**
- Cron every 15 min flips `status='expired'` and downgrades `users.plan='free'`.
- More writes; matches user perception (no zombie "paid" state).

Default plan: **A**. Cheaper, correctness equivalent at query time.

## Renewal nudge

3 days before `current_period_end`: send email (Resend, when wired) + show in-app banner. Out of scope for first ship — flag as follow-up.

## Open question — trial period

User did NOT specify. Default plan: **no free trial.** First month is paid up-front. Lower fraud risk + simpler. Flag as open question.

## Cancellation flow

For bank-transfer model, cancellation = "don't renew." User simply doesn't transfer next month → status auto-flips to expired. No active cancel endpoint needed for v1. Refund logic deferred (manual via SePay dashboard if requested).

## Sources

- `.claude/skills/payment-integration/references/sepay/overview.md`
- `.claude/skills/payment-integration/references/sepay/webhooks.md`
- `.claude/skills/payment-integration/references/sepay/qr-codes.md`
- `.claude/skills/payment-integration/references/sepay/best-practices.md` — UUID parsing, multi-strategy match, timing-safe auth, always-200 pattern
- `.claude/skills/payment-integration/scripts/sepay-webhook-verify.js`
