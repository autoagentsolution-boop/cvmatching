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
