// POST /api/checkout/sepay — mint a SePay order for the authed user.
// Returns QR URL + bank details + memo. Client polls /api/orders/[id]/status.
// Idempotency: each call mints a fresh orderId; cancel by letting it expire.

import { NextResponse } from 'next/server';
import { getDb, orders } from '@/db';
import { env } from '@/lib/env';
import { getSession } from '@/lib/get-session';
import { isMonetizationEnabled } from '@/lib/monetization/flag';
import { ensureUserRow } from '@/lib/users/ensure-user-row';
import { buildOrderMemo, generateVietQRUrl } from '@/lib/payments/sepay-qr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PRICE_VND = 99_000;

function priceVnd(): number {
  const raw = env.PAID_PLAN_PRICE_VND;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PRICE_VND;
}

export async function POST() {
  if (!isMonetizationEnabled()) {
    return NextResponse.json({ error: 'monetization_disabled' }, { status: 503 });
  }

  if (!env.SEPAY_ACCOUNT_NUMBER || !env.SEPAY_BANK_NAME || !env.SEPAY_ACCOUNT_NAME) {
    return NextResponse.json({ error: 'sepay_not_configured' }, { status: 503 });
  }

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  await ensureUserRow(session);

  const orderId = crypto.randomUUID();
  const amount = priceVnd();
  const content = buildOrderMemo(orderId);

  const db = getDb();
  await db.insert(orders).values({
    id: orderId,
    userId: session.user.id,
    amountVnd: amount,
    status: 'pending',
    paymentId: content,
  });

  const qrUrl = generateVietQRUrl({
    accountNumber: env.SEPAY_ACCOUNT_NUMBER,
    bankName: env.SEPAY_BANK_NAME,
    amountVnd: amount,
    content,
  });

  return NextResponse.json({
    orderId,
    amountVnd: amount,
    content,
    qrUrl,
    bank: {
      accountNumber: env.SEPAY_ACCOUNT_NUMBER,
      accountName: env.SEPAY_ACCOUNT_NAME,
      bankName: env.SEPAY_BANK_NAME,
    },
    statusCheckUrl: `/api/orders/${orderId}/status`,
    // Pending → expired after 30 min (lazy: status route reports expired).
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
}
