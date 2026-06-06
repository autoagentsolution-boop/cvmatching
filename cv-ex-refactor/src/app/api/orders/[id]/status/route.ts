// GET /api/orders/[id]/status — poller endpoint for /upgrade page.
// Authed-only. Returns owner-scoped order state. Lazy-expires pending orders
// older than 30 min on read (avoids a cron just for expiry).

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb, orders } from '@/db';
import { getSession } from '@/lib/get-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PENDING_TTL_MS = 30 * 60 * 1000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.userId, session.user.id)))
    .limit(1);

  const row = rows[0];
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let status = row.status;
  if (status === 'pending' && Date.now() - row.createdAt.getTime() > PENDING_TTL_MS) {
    await db.update(orders).set({ status: 'expired' }).where(eq(orders.id, id));
    status = 'expired';
  }

  return NextResponse.json({
    orderId: row.id,
    status,
    amountVnd: row.amountVnd,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
  });
}
