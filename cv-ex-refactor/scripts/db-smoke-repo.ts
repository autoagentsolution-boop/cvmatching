// End-to-end smoke against repo-postgres. Exercises all 8 JobsRepo methods
// against the live Neon DB with synthetic test data, then cleans up.
//
//   pnpm tsx --env-file=.env.local scripts/db-smoke-repo.ts
//
// Run after Phase 1 migration. Validates the full data-access layer before
// Phase 3 (KV migration) and Phase 4 (recommend route cutover).

import { eq } from 'drizzle-orm';
import { getDb, jobs } from '../src/db';
import * as repo from '../src/lib/jobs/repo-postgres';
import type { Job } from '../src/lib/jobs/types';

const STAMP = Date.now();
const TEST_IDS = [
  `smoke-job-${STAMP}-A`,
  `smoke-job-${STAMP}-B`,
  `smoke-job-${STAMP}-C`,
];

function syntheticEmbedding(seed: number): string {
  // Random unit-ish vector. Not L2-normalized — we just need bytes the codec
  // can round-trip. 768 × float32 → base64.
  const buf = Buffer.alloc(768 * 4);
  let s = seed >>> 0;
  for (let i = 0; i < 768; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    buf.writeFloatLE((s | 0) / 2 ** 31, i * 4);
  }
  return buf.toString('base64');
}

function makeJob(id: string, vertical: Job['vertical'], seed: number): Job {
  return {
    id,
    title: `Smoke job ${id}`,
    company: 'Acme Smoke Co',
    vertical,
    seniority: 'mid',
    description: 'Synthetic job for db-smoke-repo.',
    sourceUrl: `https://smoke.example.com/${id}`,
    source: 'other',
    location: 'Remote',
    postedAt: new Date(STAMP).toISOString(),
    verifiedAt: new Date(STAMP).toISOString(),
    embedding: syntheticEmbedding(seed),
  };
}

async function cleanup() {
  const db = getDb();
  // Direct delete via Drizzle to bypass expireJob (which only flips active).
  for (const id of TEST_IDS) {
    await db.delete(jobs).where(eq(jobs.id, id));
  }
}

async function main() {
  console.log('[db-smoke-repo] cleaning any stale rows from prior smoke...');
  await cleanup();

  // saveJob
  console.log('[db-smoke-repo] saveJob × 3');
  const jobA = makeJob(TEST_IDS[0]!, 'tech', 100);
  const jobB = makeJob(TEST_IDS[1]!, 'tech', 200);
  const jobC = makeJob(TEST_IDS[2]!, 'finance', 300);
  await repo.saveJob(jobA);
  await repo.saveJob(jobB);
  await repo.saveJob(jobC);

  // getJob
  console.log('[db-smoke-repo] getJob');
  const fetched = await repo.getJob(TEST_IDS[0]!);
  if (!fetched || fetched.id !== TEST_IDS[0]) throw new Error('getJob mismatch');
  if (fetched.vertical !== 'tech') throw new Error(`vertical mismatch: ${fetched.vertical}`);

  // getJobBatch
  console.log('[db-smoke-repo] getJobBatch');
  const batch = await repo.getJobBatch(TEST_IDS);
  if (batch.length !== 3) throw new Error(`batch length ${batch.length} expected 3`);

  // isActiveJob
  console.log('[db-smoke-repo] isActiveJob');
  if (!(await repo.isActiveJob(TEST_IDS[0]!))) throw new Error('A should be active');

  // listActiveIds — includes our test ids
  console.log('[db-smoke-repo] listActiveIds');
  const active = await repo.listActiveIds();
  for (const id of TEST_IDS) {
    if (!active.includes(id)) throw new Error(`${id} not in active list`);
  }

  // touchVerifiedAt
  console.log('[db-smoke-repo] touchVerifiedAt');
  const newIso = new Date(STAMP + 60_000).toISOString();
  await repo.touchVerifiedAt(TEST_IDS[0]!, newIso);
  const touched = await repo.getJob(TEST_IDS[0]!);
  if (!touched || touched.verifiedAt.slice(0, 19) !== newIso.slice(0, 19)) {
    throw new Error(`touchVerifiedAt mismatch: got ${touched?.verifiedAt}`);
  }

  // expireJob
  console.log('[db-smoke-repo] expireJob');
  await repo.expireJob(TEST_IDS[2]!);
  if (await repo.isActiveJob(TEST_IDS[2]!)) throw new Error('C should be expired');

  // topKByEmbedding — query with A's vector should rank A first
  console.log('[db-smoke-repo] topKByEmbedding (vertical=tech, k=2)');
  const buf = Buffer.from(jobA.embedding, 'base64');
  const queryVec = new Float32Array(buf.buffer, buf.byteOffset, 768);
  const top = await repo.topKByEmbedding(queryVec, { k: 2, vertical: 'tech' });
  if (top.length !== 2) throw new Error(`topK length ${top.length} expected 2`);
  if (top[0]!.id !== TEST_IDS[0]) {
    throw new Error(`expected A on top, got ${top[0]!.id} (score=${top[0]!.score})`);
  }
  // Self-similarity ~1
  if (top[0]!.score < 0.99) {
    throw new Error(`self-similarity too low: ${top[0]!.score}`);
  }
  console.log(`[db-smoke-repo]   top result: ${top[0]!.id} score=${top[0]!.score.toFixed(6)}`);
  console.log(`[db-smoke-repo]   2nd:        ${top[1]!.id} score=${top[1]!.score.toFixed(6)}`);

  // excludeIds filter
  console.log('[db-smoke-repo] topKByEmbedding excludeIds=[A]');
  const top2 = await repo.topKByEmbedding(queryVec, {
    k: 2,
    vertical: 'tech',
    excludeIds: [TEST_IDS[0]!],
  });
  if (top2.some((r) => r.id === TEST_IDS[0])) {
    throw new Error('excludeIds did not filter out A');
  }
  if (top2[0]!.id !== TEST_IDS[1]) {
    throw new Error(`expected B after exclude, got ${top2[0]!.id}`);
  }

  // Cleanup
  console.log('[db-smoke-repo] cleanup');
  await cleanup();

  console.log('[db-smoke-repo] PASS — all 8 methods + filters round-trip clean');
}

main().catch((err) => {
  console.error('[db-smoke-repo] FATAL:', err instanceof Error ? err.stack : err);
  cleanup().finally(() => process.exit(1));
});
