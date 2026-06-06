// JWT-strategy NextAuth doesn't persist user rows, but orders/subscriptions
// FK to `users.id`. Lazy-upsert on the first paid-funnel action — checkout,
// webhook target lookup, or dedup write. Idempotent: same row keyed by
// session.user.id (Google sub).

import { eq } from 'drizzle-orm';
import type { Session } from 'next-auth';
import { getDb, users } from '@/db';

export async function ensureUserRow(session: Session | null): Promise<string> {
  const userId = session?.user?.id;
  if (!userId) throw new Error('ensureUserRow: no session.user.id');

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existing.length > 0) return userId;

  // Race-safe: ON CONFLICT DO NOTHING for the rare double-create.
  await db
    .insert(users)
    .values({ id: userId, email: session?.user?.email ?? null })
    .onConflictDoNothing({ target: users.id });

  return userId;
}
