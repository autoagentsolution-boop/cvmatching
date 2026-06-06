// Resolve a request's user tier — anon / free / paid. Used by the Job Fit
// recommend route (Phase 4 of jobfit-db-pool-monetize) to gate the tiers
// of jobs surfaced + the cap on count.
//
// When monetization is enabled (MONETIZATION_ENABLED=1): source of truth =
// `subscriptions` table. A row with status='active' AND current_period_end >
// now() means the user is paid this billing cycle. Anyone signed-in but
// without such a row is 'free'. No session = 'anon'.
//
// When monetization is OFF (pre-launch): there's no /upgrade path for users
// to reach 'paid', so leaving signed-in users at 'free' (2-job cap) would
// strand them. Promote every signed-in user to 'paid' until pricing ships.
// Anon stays anon (1-job teaser unchanged).

import { and, eq, gt } from 'drizzle-orm';
import type { Session } from 'next-auth';
import { getDb, subscriptions } from '@/db';
import { isMonetizationEnabled } from '@/lib/monetization/flag';

export type UserTier = 'anon' | 'free' | 'paid';

/**
 * Server-side tier resolution. Never trust a client-passed tier — this is
 * the canonical check. ~30ms p50 against Neon when subscriptions row exists
 * (indexed lookup on subscriptions_user_active_idx).
 */
export async function resolveUserTier(session: Session | null): Promise<UserTier> {
  const userId = session?.user?.id;
  if (!userId) return 'anon';

  if (!isMonetizationEnabled()) return 'paid';

  const db = getDb();
  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active'),
        gt(subscriptions.currentPeriodEnd, new Date()),
      ),
    )
    .limit(1);

  return rows.length > 0 ? 'paid' : 'free';
}
