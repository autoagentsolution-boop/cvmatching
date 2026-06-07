// Mark jobs as inactive when verifiedAt is older than 21 days.
//
// Switched to PG in pre-2K hardening (2026-06-07). KV path expired jobs
// that no longer existed in the source-of-truth Postgres after Phase 4
// cutover — visual noise + did nothing useful.
//
// Single UPDATE replaces the per-id loop: at 2K+ jobs that loop was N
// round-trips; the SQL update is 1.

import { sql } from 'drizzle-orm';
import { getDb } from '../src/db/index.js';
import { jobs } from '../src/db/schema.js';

const EXPIRE_DAYS = 21;

export async function run(): Promise<void> {
  const db = getDb();

  // Single UPDATE filtered by verifiedAt cutoff. RETURNING gives us the
  // exact rows that flipped for the summary log.
  const result = await db.execute<{ id: string; title: string; company: string }>(sql`
    UPDATE ${jobs}
    SET active = false
    WHERE active = true
      AND verified_at < now() - (${EXPIRE_DAYS} || ' days')::interval
    RETURNING id, title, company
  `);

  const rows = (Array.isArray(result) ? result : result.rows ?? []) as Array<{
    id: string;
    title: string;
    company: string;
  }>;

  for (const row of rows) {
    console.log(`[ingest expire] Expired: ${row.title} @ ${row.company} (${row.id})`);
  }

  console.log(`\n[ingest expire] Done. Expired: ${rows.length} (verifiedAt > ${EXPIRE_DAYS}d).`);
}
