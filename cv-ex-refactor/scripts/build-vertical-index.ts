// Scan active jobs in KV, group by vertical, persist `jobs:by-vertical` index.
// Run after ingest / refresh to keep the recommend route's vertical pre-filter aligned.
// Idempotent — overwrites the index in one shot.

import { backfillVerticalIndex } from '../src/lib/jobs/vertical-index.js';

export async function run(): Promise<void> {
  const idx = await backfillVerticalIndex();
  const summary = Object.fromEntries(
    Object.entries(idx).map(([v, ids]) => [v, ids?.length ?? 0]),
  );
  console.log(JSON.stringify({ ok: true, byVertical: summary, total: Object.values(summary).reduce((a, b) => a + (b as number), 0) }, null, 2));
}
