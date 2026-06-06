// Subscription state mutation. Renewal-by-transfer model — each successful
// transfer mints a fresh 30-day window. Multiple historical rows per user
// allowed; `resolveUserTier` queries by status='active' + end > now().

import { and, eq, gt } from 'drizzle-orm';
import { getDb, subscriptions, users } from '@/db';

const MONTH_MS = 30 * 24 * 3600 * 1000;

export interface ActivationResult {
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  extended: boolean;
}

/**
 * Activate (or extend) a subscription on successful payment. If the user has
 * an active sub still in window, extend its end-date by +30d ("stack" remaining
 * balance). Otherwise insert a fresh row.
 */
export async function activateSubscription(
  userId: string,
  sepayOrderId: string,
): Promise<ActivationResult> {
  const db = getDb();
  const now = new Date();

  const active = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active'),
        gt(subscriptions.currentPeriodEnd, now),
      ),
    )
    .limit(1);

  if (active[0]) {
    const newEnd = new Date(active[0].currentPeriodEnd.getTime() + MONTH_MS);
    await db
      .update(subscriptions)
      .set({ currentPeriodEnd: newEnd, sepayOrderId })
      .where(eq(subscriptions.id, active[0].id));
    await db
      .update(users)
      .set({ plan: 'paid', planUpdatedAt: now })
      .where(eq(users.id, userId));
    return {
      subscriptionId: active[0].id,
      periodStart: active[0].currentPeriodStart,
      periodEnd: newEnd,
      extended: true,
    };
  }

  const id = crypto.randomUUID();
  const periodStart = now;
  const periodEnd = new Date(now.getTime() + MONTH_MS);
  await db.insert(subscriptions).values({
    id,
    userId,
    status: 'active',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    sepayOrderId,
  });
  await db
    .update(users)
    .set({ plan: 'paid', planUpdatedAt: now })
    .where(eq(users.id, userId));
  return { subscriptionId: id, periodStart, periodEnd, extended: false };
}
