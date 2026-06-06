// KV-backed CRUD for the Job domain.
// Fail-loud: throws if KV is not configured — this module is operator-CLI only.
// Key layout:
//   job:<id>                    HASH (all Job fields)
//   jobs:active                 SET of active job ids
//   jobs:expired                SET of expired job ids
//   embeddings:active:current   STRING 'v<n>'
//   embeddings:active:v<n>:chunks   STRING count
//   embeddings:active:v<n>:ids      STRING JSON array
//   embeddings:active:v<n>:chunk:<i> STRING base64 blob

import { kv, kvAvailable } from '@/lib/quota/kv-client';
import type { Job } from './types';
import type { JobsRepo, TopKOpts, TopKResult } from './repo-interface';

function assertKv(): void {
  if (!kvAvailable) {
    throw new Error(
      'KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in .env.local',
    );
  }
}

export async function getJob(id: string): Promise<Job | null> {
  assertKv();
  const raw = await kv.hgetall<Record<string, string>>(`job:${id}`);
  if (!raw) return null;
  return raw as unknown as Job;
}

export async function saveJob(job: Job): Promise<void> {
  assertKv();
  // hset accepts a flat object; cast required because @vercel/kv types expect Record<string,unknown>
  await kv.hset(`job:${job.id}`, job as unknown as Record<string, unknown>);
  await kv.sadd('jobs:active', job.id);
}

export async function listActiveIds(): Promise<string[]> {
  assertKv();
  const members = await kv.smembers('jobs:active');
  return members as string[];
}

export async function listExpiredIds(): Promise<string[]> {
  assertKv();
  const members = await kv.smembers('jobs:expired');
  return members as string[];
}

export async function expireJob(id: string): Promise<void> {
  assertKv();
  // smove is atomic — moves id from active to expired set
  await kv.smove('jobs:active', 'jobs:expired', id);
}

export async function isActiveJob(id: string): Promise<boolean> {
  assertKv();
  const result = await kv.sismember('jobs:active', id);
  return result === 1;
}

/**
 * Batch-fetch jobs by id. Returns only jobs that exist in KV (missing ids are silently skipped).
 * Uses sequential hgetall calls — Upstash REST does not support pipelining HGETALL.
 */
export async function getJobBatch(ids: string[]): Promise<Job[]> {
  assertKv();
  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map((id) =>
      kv
        .hgetall<Record<string, string>>(`job:${id}`)
        .then((raw) => (raw ? (raw as unknown as Job) : null))
        .catch(() => null),
    ),
  );

  return results.filter((j): j is Job => j !== null);
}

/**
 * Update verifiedAt timestamp for a job without touching other fields.
 * Used by the refresh cron to mark a job as live without re-ingesting.
 */
export async function touchVerifiedAt(id: string, isoTimestamp: string): Promise<void> {
  assertKv();
  await kv.hset(`job:${id}`, { verifiedAt: isoTimestamp } as unknown as Record<string, unknown>);
}

// ── Embedding blob version management ──────────────────────────────────────

export async function getActiveBlobVersion(): Promise<string | null> {
  assertKv();
  return kv.get<string>('embeddings:active:current');
}

export async function setActiveBlobVersion(version: string): Promise<void> {
  assertKv();
  await kv.set('embeddings:active:current', version);
}

export async function saveBlobChunk(
  version: string,
  idx: number,
  base64: string,
): Promise<void> {
  assertKv();
  await kv.set(`embeddings:active:${version}:chunk:${idx}`, base64);
}

export async function saveBlobMeta(
  version: string,
  ids: string[],
  chunkCount: number,
): Promise<void> {
  assertKv();
  await kv.set(`embeddings:active:${version}:ids`, JSON.stringify(ids));
  await kv.set(`embeddings:active:${version}:chunks`, String(chunkCount));
}

export async function loadBlobChunks(
  version: string,
): Promise<{ ids: string[]; chunks: Buffer[] }> {
  assertKv();

  // Upstash REST auto-parses JSON-stringified values on get(), so values written via
  // `String(n)` / `JSON.stringify(arr)` come back as number/array — not the typed string.
  const countRaw = await kv.get<unknown>(`embeddings:active:${version}:chunks`);
  if (countRaw === null || countRaw === undefined) {
    throw new Error(`No blob found for version ${version}`);
  }
  const count = typeof countRaw === 'number' ? countRaw : parseInt(String(countRaw), 10);

  const idsRaw = await kv.get<unknown>(`embeddings:active:${version}:ids`);
  if (idsRaw === null || idsRaw === undefined) {
    throw new Error(`Missing ids key for version ${version}`);
  }
  const ids: string[] = Array.isArray(idsRaw)
    ? (idsRaw as string[])
    : (JSON.parse(String(idsRaw)) as string[]);

  const chunks: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const b64 = await kv.get<string>(`embeddings:active:${version}:chunk:${i}`);
    if (!b64) throw new Error(`Missing chunk ${i} for version ${version}`);
    chunks.push(Buffer.from(b64, 'base64'));
  }

  return { ids, chunks };
}

// ─── JobsRepo interface compat ────────────────────────────────────────────
//
// Phase 02 of jobfit-db-pool-monetize plan: legacy KV repo declares
// `implements JobsRepo` so the type system catches drift between the two
// impls. KV repo cannot implement topKByEmbedding (no pgvector); throw a
// fail-loud error so anyone wiring it up before Phase 04 cutover gets a
// crystal-clear signal. Deleted in Phase 08.

async function topKByEmbedding(
  _query: Float32Array,
  _opts: TopKOpts,
): Promise<TopKResult[]> {
  throw new Error(
    'topKByEmbedding is not supported on the legacy KV repo. Use repo-postgres for vector queries.',
  );
}

export const repoKv: JobsRepo = {
  getJob,
  getJobBatch,
  saveJob,
  expireJob,
  isActiveJob,
  listActiveIds,
  touchVerifiedAt,
  topKByEmbedding,
};
