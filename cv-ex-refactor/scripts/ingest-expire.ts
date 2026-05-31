// Mark jobs as expired when verifiedAt is older than 21 days.

import { listActiveIds, getJob, expireJob } from '../src/lib/jobs/repo.js';

const EXPIRE_DAYS = 21;
const EXPIRE_MS = EXPIRE_DAYS * 24 * 60 * 60 * 1_000;

export async function run(): Promise<void> {
  const ids = await listActiveIds();
  const now = Date.now();
  let expired = 0;
  let kept = 0;
  let missing = 0;

  for (const id of ids) {
    const job = await getJob(id);
    if (!job) {
      missing++;
      continue;
    }

    const age = now - new Date(job.verifiedAt).getTime();
    if (age > EXPIRE_MS) {
      await expireJob(id);
      console.log(`[ingest expire] Expired: ${job.title} @ ${job.company} (${job.id})`);
      expired++;
    } else {
      kept++;
    }
  }

  console.log(
    `\n[ingest expire] Done. Expired: ${expired}, Kept: ${kept}, Missing: ${missing}, Total checked: ${ids.length}`,
  );
}
