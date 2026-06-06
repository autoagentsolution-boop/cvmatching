// Persistent per-user "seen" dedup. Phase 4 of jobfit-db-pool-monetize.
//
// Signed-in users get a `user_seen_job` row per (userId, jobId) inserted at
// recommend-response time. The next recommend call NOT EXISTS-filters those
// rows out at the SQL layer (see repo-postgres.topKByEmbedding).
//
// Anonymous users don't hit this; client-side sessionStorage holds their
// seen list and replays it as `seenIds` in the request body.
//
// Composite PK (user_id, job_id) makes onConflictDoNothing idempotent —
// safe under double-click + retry.

import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb, userSeenJob } from '@/db';

export async function markSeenForUser(userId: string, jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;

  // Deduplicate the input client-side; pg would handle it via the PK but
  // sending a tighter payload saves a few bytes per request.
  const unique = Array.from(new Set(jobIds));
  const rows = unique.map((jobId) => ({ userId, jobId }));

  const db = getDb();
  await db.insert(userSeenJob).values(rows).onConflictDoNothing();
}

/**
 * Count `user_seen_job` rows for `userId` inside the 90-day TTL window.
 * Used by the exhaustedPool detection in the recommend route to disambiguate
 * "0 candidates because pool is empty" vs "0 candidates because user already
 * saw them all".
 */
export async function seenCountForUser(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(userSeenJob)
    .where(
      and(
        eq(userSeenJob.userId, userId),
        gt(userSeenJob.seenAt, sql`now() - interval '90 days'`),
      ),
    );
  return rows[0]?.n ?? 0;
}

/**
 * Delete every `user_seen_job` row for `userId`. Used by the admin reset
 * endpoint — drops dedup state so the user can re-see jobs they've already
 * seen. Returns the number of deleted rows.
 */
export async function clearSeenForUser(userId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .delete(userSeenJob)
    .where(eq(userSeenJob.userId, userId))
    .returning({ jobId: userSeenJob.jobId });
  return result.length;
}
