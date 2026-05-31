// Print active/expired job counts broken down by vertical and seniority.

import { listActiveIds, listExpiredIds, getJob } from '../src/lib/jobs/repo.js';
import type { Vertical, Seniority } from '../src/lib/jobs/types.js';

export async function run(): Promise<void> {
  const [activeIds, expiredIds] = await Promise.all([listActiveIds(), listExpiredIds()]);

  const byVertical: Record<string, number> = {};
  const bySeniority: Record<string, number> = {};

  for (const id of activeIds) {
    const job = await getJob(id);
    if (!job) continue;

    byVertical[job.vertical] = (byVertical[job.vertical] ?? 0) + 1;
    bySeniority[job.seniority] = (bySeniority[job.seniority] ?? 0) + 1;
  }

  const stats = {
    active: activeIds.length,
    expired: expiredIds.length,
    byVertical: byVertical as Record<Vertical, number>,
    bySeniority: bySeniority as Record<Seniority, number>,
  };

  console.log(JSON.stringify(stats, null, 2));
}
