# Phase 06 — Monetization (SePay VietQR subscription + /upgrade UI)

## Context Links

- Research: [research/sepay-subscription-flow.md](./research/sepay-subscription-flow.md)
- Skill refs: `.claude/skills/payment-integration/references/sepay/{webhooks,qr-codes,best-practices}.md`
- Helper script: `.claude/skills/payment-integration/scripts/sepay-webhook-verify.js`
- Schema: Phase 01 tables `users`, `subscriptions`, `orders`, `sepay_webhook_events`
- Tier gate caller: Phase 04 `resolveUserTier`

## Overview

- Priority: P1
- Status: pending
- Effort: 6-8h
- Blocks: full launch (paid tier inaccessible until shipped)
- Blocked by: 04 (recommend gate needs paid-aware tier check)

Wire SePay (Vietnamese bank-transfer payment) as a renewal-by-transfer subscription. User clicks Upgrade → mints order with VietQR → scans + transfers → SePay webhook flips subscription to active. No card auto-renewal. Monthly cycle, manual renew.

## Key Insights

- SePay has no native recurring billing — model as "renewal-by-transfer": each month is a fresh transfer with the same workflow.
- Match transactions via `parseOrderIdFromContent` (UUID extraction with bank dash-stripping handling per best-practices.md).
- Webhook MUST always return 200 (prevents 7-retry storm). Idempotency via `sepay_webhook_events.event_id` PRIMARY KEY.
- Plan price default: **99,000 VND/month** (override in env). Open question listed in plan.md.
- Content format: `RR {orderUUID}` (RR = ResumeRefine; 40 chars max under VN bank memo limits).
- Webhook auth: timing-safe compare of `Authorization: Apikey <key>` against `SEPAY_WEBHOOK_API_KEY`.

## Requirements

**Functional:**
- `/upgrade` page (authenticated only): displays QR + order details + status poller.
- `POST /api/checkout/sepay` → creates order, returns QR URL + amount + content.
- `GET /api/orders/:id/status` → returns `pending | completed | expired`.
- `POST /api/webhooks/sepay` → receives SePay event, idempotent process, flips subscription.
- Order TTL: pending orders expire after 30 min (cron OR lazy check).
- `users.plan` synced with active subscription status.

**Non-functional:**
- Webhook response ≤2s p95 (well under SePay's 5s timeout).
- Always 200 to SePay regardless of internal error.
- No production-only webhook test endpoints (prod webhook is sole path).
- Add new cost-guard bucket `sepay-webhook` (rate-limit instrument; no LLM cost).

## Architecture

```
User → /upgrade page
  ↓ click "Upgrade to Pro"
  POST /api/checkout/sepay { plan: 'monthly' }
  ↓
  Server:
    - Insert orders {id=uuid, userId, amount=99000, status='pending', paymentId=`RR ${uuid}`}
    - Return { orderId, qrUrl, amount, content }
  ↓
  UI polls GET /api/orders/:id/status every 3s (max 10 min)
  ↓ (user opens bank app, scans QR, transfers)
  Bank → SePay → POST /api/webhooks/sepay
  ↓
  Webhook handler:
    1. timing-safe-eq auth header
    2. INSERT INTO sepay_webhook_events (event_id, payload) ON CONFLICT DO NOTHING
    3. if conflict → 200 {success:true} (dup)
    4. parse content → orderId
    5. SELECT order; verify status='pending'; verify amount >= order.amount
    6. tx:
       UPDATE orders SET status='completed', paid_at=now, match_method=...
       UPSERT subscriptions (userId, status='active',
              current_period_start=now, current_period_end=now+30d)
       UPDATE users SET plan='paid'
       UPDATE sepay_webhook_events SET processed=true, processed_at=now
    7. return 200 {success:true}
  ↓
  UI sees status='completed' → redirect to /job-fit with "Pro" badge
```

## Related Code Files

**To create:**
- `cv-ex-refactor/src/app/upgrade/page.tsx` — server component, QR + status poller.
- `cv-ex-refactor/src/app/upgrade/upgrade-client.tsx` — client component for polling.
- `cv-ex-refactor/src/app/api/checkout/sepay/route.ts` — order creation.
- `cv-ex-refactor/src/app/api/orders/[id]/status/route.ts` — status check.
- `cv-ex-refactor/src/app/api/webhooks/sepay/route.ts` — webhook handler.
- `cv-ex-refactor/src/lib/payments/sepay-qr.ts` — `generateVietQRUrl` helper.
- `cv-ex-refactor/src/lib/payments/sepay-match.ts` — `parseOrderIdFromContent`, `normalizeUUID`, multi-strategy match.
- `cv-ex-refactor/src/lib/payments/subscriptions.ts` — `upsertActiveSubscription(userId, orderId)`.

**To modify:**
- `cv-ex-refactor/src/lib/env.ts` — add SEPAY_* env vars (optional in dev).
- `cv-ex-refactor/src/lib/cost/buckets.ts` — register `sepay-webhook` bucket.
- `cv-ex-refactor/src/components/header.tsx` (or equivalent nav) — add "Upgrade" link when `tier === 'free'`.
- `docs/deployment.md` §14 — list new env vars.
- `docs/deployment.md` §17 — add SePay cost-guard bucket.

**To delete:** none.

## Implementation Steps

1. **Env vars** (Vercel dashboard, production only):
   ```
   SEPAY_WEBHOOK_API_KEY=<from SePay dashboard>
   SEPAY_ACCOUNT_NUMBER=<bank account>
   SEPAY_ACCOUNT_NAME=RESUMEREFINE
   SEPAY_BANK_NAME=Vietcombank
   PAID_PLAN_PRICE_VND=99000
   ```

2. **Configure SePay dashboard:**
   - Webhook URL: `https://resume-refactor.vercel.app/api/webhooks/sepay`
   - Auth type: `Api_Key`
   - Event: `In_only`
   - Filter: account number matches `SEPAY_ACCOUNT_NUMBER`.

3. **`sepay-qr.ts`:** copy `generateVietQRUrl` verbatim from best-practices.md.

4. **`sepay-match.ts`:** copy `parseOrderIdFromContent` + `normalizeUUID` + multi-strategy `findOrderByTransaction` from best-practices.md, adapt to Drizzle.

5. **`subscriptions.ts`:**
   ```ts
   export async function upsertActiveSubscription(userId: string, orderId: string) {
     const start = new Date();
     const end = new Date(start.getTime() + 30*24*3600*1000);
     await db.insert(subscriptions).values({
       id: crypto.randomUUID(), userId, status: 'active',
       currentPeriodStart: start, currentPeriodEnd: end, sepayOrderId: orderId,
     }).onConflictDoUpdate({
       target: subscriptions.userId,  // requires UNIQUE constraint added in Phase 01 review
       set: { status: 'active', currentPeriodStart: start, currentPeriodEnd: end, sepayOrderId: orderId },
     });
     await db.update(users).set({ plan: 'paid', planUpdatedAt: start }).where(eq(users.id, userId));
   }
   ```
   - NB: Phase 01 schema should add `UNIQUE (user_id)` on subscriptions if only one active sub per user — OR keep multiple rows and query by latest. Default: latest. Adjust UPSERT accordingly.

6. **Checkout route:**
   - Auth-gate (require session).
   - Insert order with `paymentId = \`RR ${orderId}\``.
   - Generate QR URL.
   - Return { orderId, qrUrl, amount: PAID_PLAN_PRICE_VND, content }.

7. **Status route:** simple `SELECT status FROM orders WHERE id = $1 AND user_id = $auth`. Auth-gate.

8. **Webhook route** — per best-practices.md `verifyWebhookAuth` + always-200 pattern. Insert into `sepay_webhook_events` first (idempotency). On success, run the tx (steps 5-7 in Architecture).

9. **/upgrade page:**
   - SSR fetches user's current tier.
   - If paid → redirect to /job-fit with "already Pro" toast.
   - Else: render upgrade-client with `<img src={qrUrl}>`, account details, content, instructions in VN + EN.
   - Client polls `/api/orders/:id/status` every 3s; on `completed` → redirect.

10. **Nav update:** show "Upgrade" link to signed-in free users.

11. **Tests:**
    - Unit: UUID parse with all bank-transformation cases (copy fixtures from best-practices.md tests).
    - Integration: simulate webhook payload with valid signature → assert subscription created + user.plan='paid'.
    - Integration: duplicate webhook with same id → returns 200, no double-process.
    - Integration: unauthenticated webhook → 401.

## Todo List

- [ ] Add SePay env vars in Vercel prod (operator action)
- [ ] Configure SePay dashboard webhook (URL + auth key + filter)
- [ ] Write src/lib/payments/sepay-qr.ts
- [ ] Write src/lib/payments/sepay-match.ts + UUID tests
- [ ] Write src/lib/payments/subscriptions.ts
- [ ] Write /api/checkout/sepay route + auth gate
- [ ] Write /api/orders/[id]/status route
- [ ] Write /api/webhooks/sepay route + idempotency + always-200
- [ ] Build /upgrade page with QR + poller
- [ ] Add nav "Upgrade" link
- [ ] Register sepay-webhook cost-guard bucket
- [ ] Manual end-to-end test: real 1000 VND transfer to dev account, observe subscription flip
- [ ] Update docs/deployment.md §14 + §17

## Success Criteria

- Real bank transfer (any amount ≥ PAID_PLAN_PRICE_VND with valid RR-content) triggers subscription activation within 5s of bank confirmation.
- Duplicate webhook (same event_id) processed exactly once.
- Underpayment rejected (order stays pending, logs error).
- Overpayment accepted (subscription activated).
- /upgrade page renders QR + auto-redirects on completion.
- Free → Paid transition reflects in recommend output (up to 10 jobs incl. tier S/A) on next request.

## Risk Assessment

| # | Risk | L | I | Mit |
|---|---|---|---|---|
| 1 | Webhook fails idempotency under high concurrency | L | M | PRIMARY KEY on event_id prevents double-insert; tx handles atomic state update |
| 2 | User transfers without RR-content (forgets to copy) → orphan transaction | M | M | Multi-strategy match (amount + timestamp window). Surface unmatched transactions in admin log; manual reconcile via dashboard |
| 3 | SePay outage during transfer window | L | H | Operator monitoring of SePay dashboard; manual subscription flip via admin endpoint if needed |
| 4 | Bank dash-strips UUID → parser miss | M | L | Already handled by `normalizeUUID`; covered by skill fixtures |
| 5 | resolveUserTier cache stale after webhook flip | M | M | Webhook handler purges per-user tier cache (Phase 04 cache key) |
| 6 | Currency drift (operator changes price mid-cycle) | L | L | Lock `amount` at order creation time; webhook compares against stored amount, not env |

## Security Considerations

- Webhook secret: `SEPAY_WEBHOOK_API_KEY` is HIGH-sensitivity; never log it; rotate quarterly.
- Timing-safe comparison (mandatory; never `===` for secrets).
- IP whitelist: defer — SePay doesn't publish stable IPs; rely on API key.
- Order metadata may contain encrypted PII (VAT tax IDs); skip VAT path for v1.
- Always 200 prevents probing of internal errors via SePay retry behavior.
- HTTPS only (Vercel handles).

## Rollback Plan

- Feature flag `MONETIZATION_ENABLED=true|false`. When false: /upgrade returns 404, webhook returns 503, all users treated as free (regardless of subscriptions row state).
- If checkout creates bad orders: `UPDATE orders SET status='expired' WHERE status='pending' AND created_at < now() - interval '1 day'` cron.

## Next Steps

- Phase 07 polishes refresh dedup + handles "no more matches" UX (works for both free + paid).
- Phase 08 cutover decommissions KV-only paths.
- Follow-up plan: renewal nudge emails (Resend), explicit cancel endpoint, trial period A/B.
