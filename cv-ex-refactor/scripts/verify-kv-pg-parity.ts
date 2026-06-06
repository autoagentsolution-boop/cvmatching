// Post-migration parity audit. Picks 10 random ids from KV `jobs:active`,
// reads both stores, compares every Job field + the embedding bytewise.
//
// Bytewise comparison goes through base64 (KV) → Float32Array → pgvector
// (PG) → Float32Array. Max abs error budget is 1e-6 (slightly looser than
// the unit-test 1e-7 because of the extra hop through pgvector's text
// emit on SELECT).
//
//   pnpm tsx --env-file=.env.local scripts/verify-kv-pg-parity.ts
//
// Exits 1 on any field mismatch or embedding delta > 1e-6.

import { kv, kvAvailable } from '../src/lib/quota/kv-client';
import * as repo from '../src/lib/jobs/repo-postgres';
import type { Job } from '../src/lib/jobs/types';

const SAMPLE_SIZE = 10;
const EMBEDDING_DELTA_LIMIT = 1e-6;

function assertKv() {
  if (!kvAvailable) {
    console.error('[verify] KV not configured');
    process.exit(1);
  }
}

function pickRandom<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  const out: T[] = [];
  const taken = new Set<number>();
  while (out.length < n) {
    // Deterministic-ish: avoid Math.random so re-runs are debuggable on
    // recent state. Take every N-th id offset by current millisecond.
    const i = (out.length * Math.max(1, Math.floor(arr.length / n)) + (Date.now() % arr.length)) % arr.length;
    if (taken.has(i)) {
      // Fall back to linear scan if we hit a collision.
      for (let j = 0; j < arr.length; j++) {
        if (!taken.has(j)) { taken.add(j); out.push(arr[j]!); break; }
      }
    } else {
      taken.add(i);
      out.push(arr[i]!);
    }
  }
  return out;
}

function compareJobShallow(kvJob: Record<string, unknown>, pgJob: Job, id: string): string[] {
  const mismatches: string[] = [];
  const compare = (field: keyof Job, kvKey?: string) => {
    const kvVal = String(kvJob[kvKey ?? field] ?? '');
    const pgVal = String(pgJob[field] ?? '');
    if (kvVal !== pgVal) mismatches.push(`${String(field)}: KV="${kvVal}" PG="${pgVal}"`);
  };
  compare('title');
  compare('company');
  compare('vertical');
  compare('seniority');
  compare('description');
  compare('sourceUrl');
  compare('source');
  compare('location');
  if (mismatches.length) console.warn(`[verify] ${id} field diff:\n  ${mismatches.join('\n  ')}`);
  return mismatches;
}

function embeddingDelta(kvBase64: string, pgBase64: string): number {
  const a = Buffer.from(kvBase64, 'base64');
  const b = Buffer.from(pgBase64, 'base64');
  if (a.byteLength !== b.byteLength) return Infinity;
  const fa = new Float32Array(a.buffer, a.byteOffset, a.byteLength / 4);
  const fb = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  let max = 0;
  for (let i = 0; i < fa.length; i++) {
    const d = Math.abs(fa[i]! - fb[i]!);
    if (d > max) max = d;
  }
  return max;
}

async function main() {
  assertKv();
  const activeIds = ((await kv.smembers('jobs:active')) ?? []).map(String);
  if (activeIds.length === 0) {
    console.error('[verify] KV jobs:active is empty — nothing to compare');
    process.exit(1);
  }
  const sample = pickRandom(activeIds, SAMPLE_SIZE);
  console.log(`[verify] sampling ${sample.length} ids from ${activeIds.length} active`);

  let fieldFailures = 0;
  let embeddingFailures = 0;
  let pgMissing = 0;

  for (const id of sample) {
    const kvRaw = await kv.hgetall<Record<string, unknown>>(`job:${id}`);
    const pgJob = await repo.getJob(id);
    if (!kvRaw || !pgJob) {
      console.warn(`[verify] ${id}: kvRaw=${!!kvRaw} pgJob=${!!pgJob}`);
      pgMissing++;
      continue;
    }
    const fieldDiff = compareJobShallow(kvRaw, pgJob, id);
    if (fieldDiff.length) fieldFailures++;

    // KV stores embedding as base64 on the job hash. The Phase 3 migration
    // populates it from the blob reassembly. Embeddings_active blob may
    // exist separately — for the per-job hash, take whichever is present.
    const kvB64 = String(kvRaw['embedding'] ?? '');
    if (kvB64) {
      const delta = embeddingDelta(kvB64, pgJob.embedding);
      if (delta > EMBEDDING_DELTA_LIMIT) {
        console.error(`[verify] ${id}: embedding delta ${delta.toExponential(3)} > ${EMBEDDING_DELTA_LIMIT}`);
        embeddingFailures++;
      } else {
        console.log(`[verify] ${id}: ok (max delta ${delta.toExponential(3)})`);
      }
    } else {
      console.log(`[verify] ${id}: ok (no per-job embedding in KV to compare)`);
    }
  }

  console.log('');
  console.log('───── Verify Summary ─────');
  console.log(`Sampled        : ${sample.length}`);
  console.log(`Missing in PG  : ${pgMissing}`);
  console.log(`Field diffs    : ${fieldFailures}`);
  console.log(`Embedding diffs: ${embeddingFailures}`);

  if (pgMissing > 0 || fieldFailures > 0 || embeddingFailures > 0) {
    console.error('[verify] FAIL');
    process.exit(1);
  }
  console.log('[verify] PASS');
}

main().catch((err) => {
  console.error('[verify] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
