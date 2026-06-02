// One-shot migration: normalize stored job embeddings to unit length.
// Required after switching from text-embedding-004 (auto-normalized) to
// gemini-embedding-001 + outputDimensionality=768 (NOT auto-normalized).
// Pure transformation — no API calls.
//
// Usage: pnpm exec tsx --env-file=.env.local scripts/normalize-stored-embeddings.ts

import { listActiveIds, getJob, saveJob } from '../src/lib/jobs/repo.js';
import type { Job } from '../src/lib/jobs/types.js';

function l2NormalizeInPlace(buf: Buffer): { changed: boolean; normBefore: number } {
  const view = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  let sumSq = 0;
  for (let i = 0; i < view.length; i++) sumSq += view[i]! * view[i]!;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return { changed: false, normBefore: 0 };
  if (Math.abs(norm - 1) < 1e-4) return { changed: false, normBefore: norm };
  for (let i = 0; i < view.length; i++) view[i] = view[i]! / norm;
  return { changed: true, normBefore: norm };
}

async function main(): Promise<void> {
  const ids = await listActiveIds();
  console.log(`[normalize] Active jobs: ${ids.length}`);
  if (ids.length === 0) return;

  let normalized = 0;
  let alreadyOk = 0;
  let missing = 0;
  let normSamples: number[] = [];

  for (const id of ids) {
    const job = await getJob(id);
    if (!job || !job.embedding) {
      missing++;
      continue;
    }
    const buf = Buffer.from(job.embedding, 'base64');
    const { changed, normBefore } = l2NormalizeInPlace(buf);
    if (!changed) {
      alreadyOk++;
      continue;
    }
    normSamples.push(normBefore);
    const newEmbedding = buf.toString('base64');
    const updated: Job = { ...job, embedding: newEmbedding };
    await saveJob(updated);
    normalized++;
    if (normalized % 25 === 0) console.log(`[normalize]   progressed ${normalized}/${ids.length}`);
  }

  const avgPriorNorm = normSamples.length
    ? (normSamples.reduce((a, b) => a + b, 0) / normSamples.length).toFixed(4)
    : 'n/a';
  console.log(`[normalize] Done. normalized=${normalized} alreadyOk=${alreadyOk} missing=${missing} avgPriorL2=${avgPriorNorm}`);
}

main().catch((err) => {
  console.error('[normalize] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
