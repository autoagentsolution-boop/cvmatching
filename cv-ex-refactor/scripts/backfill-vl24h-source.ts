// One-shot backfill after extending the source enum to include 'vl24h' and
// adding Vietnamese seniority patterns. For every active job, re-applies
// classifySeniority (VN patterns may relabel mid → lead/senior) and flips
// source from 'other' to 'vl24h' for vieclam24h-sourced jobs.
//
// Usage: pnpm exec tsx --env-file=.env.local scripts/backfill-vl24h-source.ts

import { listActiveIds, getJob, saveJob } from '../src/lib/jobs/repo.js';
import { classifySeniority } from '../src/lib/jobs/classify.js';

async function main(): Promise<void> {
  const ids = await listActiveIds();
  console.log(`[backfill] Active jobs: ${ids.length}`);

  let sourceUpdated = 0;
  let seniorityUpdated = 0;
  let untouched = 0;
  let missing = 0;

  for (const id of ids) {
    const job = await getJob(id);
    if (!job) { missing++; continue; }

    const patch: Partial<typeof job> = {};
    if (job.source !== 'vl24h' && job.sourceUrl.includes('vieclam24h.vn')) {
      patch.source = 'vl24h';
    }
    const newSeniority = classifySeniority(job.title);
    if (newSeniority !== job.seniority) {
      patch.seniority = newSeniority;
    }

    if (Object.keys(patch).length === 0) { untouched++; continue; }
    await saveJob({ ...job, ...patch });
    if (patch.source) sourceUpdated++;
    if (patch.seniority) seniorityUpdated++;
  }

  console.log(`[backfill] Done. source_updated=${sourceUpdated} seniority_updated=${seniorityUpdated} untouched=${untouched} missing=${missing}`);
}

main().catch((err) => {
  console.error('[backfill-vl24h] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
