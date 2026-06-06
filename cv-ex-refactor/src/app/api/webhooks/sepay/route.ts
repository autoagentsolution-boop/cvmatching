// POST /api/webhooks/sepay — SePay calls this on every bank transfer.
//
// Contract:
//   1. Timing-safe `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>` check
//      → return 401 once on auth failure (no retry loop benefit).
//   2. PK-conflict idempotency via `sepay_webhook_events.event_id`.
//   3. Always return 200 once authenticated — internal errors recorded in
//      `error` column, never bubble to SePay (prevents 7-retry storm).
//   4. State flip is best-effort sequential (Drizzle/neon-http doesn't expose
//      multi-stmt tx); each step is idempotent on its own.

import { timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb, orders, sepayWebhookEvents } from '@/db';
import { env } from '@/lib/env';
import { findOrderByTransaction, type SepayWebhookPayload } from '@/lib/payments/sepay-match';
import { activateSubscription } from '@/lib/payments/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function monetizationOff(): boolean {
  const flag = env.MONETIZATION_ENABLED;
  return flag === '0' || flag === 'false';
}

function verifyAuth(req: Request): boolean {
  const expected = env.SEPAY_WEBHOOK_API_KEY;
  if (!expected) return false;
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return false;

  let provided: string;
  if (header.startsWith('Apikey ')) provided = header.slice(7);
  else if (header.startsWith('Bearer ')) provided = header.slice(7);
  else return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (monetizationOff()) {
    return NextResponse.json({ error: 'monetization_disabled' }, { status: 503 });
  }

  if (!verifyAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: SepayWebhookPayload;
  try {
    payload = (await req.json()) as SepayWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'bad_payload' }, { status: 400 });
  }

  const db = getDb();
  const eventId = String(payload.id ?? payload.referenceCode ?? Date.now());

  // Idempotency: PK conflict means we've seen this event. Insert-or-skip via
  // onConflictDoNothing returns no rows when duplicate.
  const inserted = await db
    .insert(sepayWebhookEvents)
    .values({ eventId, payload: payload as unknown as Record<string, unknown> })
    .onConflictDoNothing({ target: sepayWebhookEvents.eventId })
    .returning({ eventId: sepayWebhookEvents.eventId });

  if (inserted.length === 0) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  // Always-200 wrapper — even errors are stored, not thrown.
  try {
    if (payload.transferType && payload.transferType !== 'in') {
      await markProcessed(eventId, 'skipped:outbound');
      return NextResponse.json({ success: true, skipped: 'outbound' });
    }

    const { order, method } = await findOrderByTransaction(payload);
    if (!order) {
      await markProcessed(eventId, 'no_match');
      return NextResponse.json({ success: true, matched: false });
    }

    if (order.status !== 'pending') {
      await markProcessed(eventId, `already:${order.status}`);
      return NextResponse.json({ success: true, alreadyProcessed: order.status });
    }

    const transferAmount = typeof payload.transferAmount === 'number' ? payload.transferAmount : 0;
    if (transferAmount < order.amountVnd) {
      await markProcessed(eventId, `underpayment:${transferAmount}<${order.amountVnd}`);
      return NextResponse.json({ success: true, rejected: 'underpayment' });
    }

    // Mark order completed first — subscriptions activation is recoverable
    // (an admin can replay activateSubscription manually if the second step
    // fails), but a missed order.status flip would let the next webhook
    // replay attempt to re-match this transfer to an already-paid invoice.
    await db
      .update(orders)
      .set({ status: 'completed', paidAt: new Date(), matchMethod: method })
      .where(eq(orders.id, order.id));

    await activateSubscription(order.userId, order.id);

    await markProcessed(eventId, null);
    return NextResponse.json({ success: true, orderId: order.id, method });
  } catch (err) {
    await markProcessed(eventId, err instanceof Error ? err.message : 'unknown_error');
    // Still 200 — SePay must not retry on our internal failures.
    return NextResponse.json({ success: true, internalError: true });
  }
}

async function markProcessed(eventId: string, error: string | null): Promise<void> {
  const db = getDb();
  await db
    .update(sepayWebhookEvents)
    .set({ processed: true, processedAt: new Date(), error })
    .where(eq(sepayWebhookEvents.eventId, eventId));
}
