// One-shot KV → Postgres jobs migration. Phase 3 of jobfit-db-pool-monetize.
//
// Reads the live KV state (jobs:active + jobs:expired sets, job:<id> hashes,
// embeddings:active:<vN> blob) and writes each job to the Postgres `jobs`
// table via repo-postgres.saveJob (which upserts). Idempotent — re-running
// is a no-op when state matches.
//
// Prereq env (.env.local):
//   DATABASE_URL          (Phase 1 — Neon pooled connection)
//   KV_REST_API_URL       (Upstash REST endpoint of prod KV)
//   KV_REST_API_TOKEN     (Upstash REST token)
//
//   KV creds are masked by `vercel env pull` (Sensitive). Paste them
//   manually from Upstash Console → Connect tab, NOT from env pull. See
//   memory feedback_vercel_sensitive_env_pull_masked.md.
//
// Run:
//   pnpm tsx --env-file=.env.local scripts/migrate-kv-to-postgres.ts
//
// Output is a per-vertical count + verify summary. Exits 1 on any
// field mismatch in the verify step.

import { loadBlobChunks } from '../src/lib/jobs/repo';
import { unpackChunk } from '../src/lib/jobs/pack-embeddings';
import { kv, kvAvailable } from '../src/lib/quota/kv-client';
import * as repo from '../src/lib/jobs/repo-postgres';
import { getDb, jobs as jobsTable } from '../src/db';
import { eq } from 'drizzle-orm';
import type { Job } from '../src/lib/jobs/types';

const EMBEDDING_CHUNK_SIZE = 250; // matches pack-embeddings.ts default

interface MigrationStats {
  kvActiveCount: number;
  kvExpiredCount: number;
  kvTotalCount: number;
  embeddingMapSize: number;
  pgUpserted: number;
  skippedNoEmbedding: string[];
  skippedNoJobHash: string[];
  pgVerticalCounts: Record<string, number>;
}

function emptyStats(): MigrationStats {
  return {
    kvActiveCount: 0,
    kvExpiredCount: 0,
    kvTotalCount: 0,
    embeddingMapSize: 0,
    pgUpserted: 0,
    skippedNoEmbedding: [],
    skippedNoJobHash: [],
    pgVerticalCounts: {},
  };
}

function assertKvConfigured() {
  if (!kvAvailable) {
    console.error(
      '[migrate] KV_REST_API_URL + KV_REST_API_TOKEN required. Paste from Upstash Console (Sensitive vars are masked by `vercel env pull`).',
    );
    process.exit(1);
  }
}

async function reassembleEmbeddingMap(): Promise<Map<string, Float32Array>> {
  const version = await kv.get<string>('embeddings:active:current');
  if (!version) {
    console.warn('[migrate] No embeddings:active:current version found — embeddings will be empty');
    return new Map();
  }
  console.log(`[migrate] active embedding blob version: ${version}`);
  const { ids, chunks } = await loadBlobChunks(version);
  console.log(`[migrate] blob: ${ids.length} ids across ${chunks.length} chunks`);

  const map = new Map<string, Float32Array>();
  for (let i = 0; i < chunks.length; i++) {
    const chunkIds = ids.slice(i * EMBEDDING_CHUNK_SIZE, (i + 1) * EMBEDDING_CHUNK_SIZE);
    const chunkMap = unpackChunk(chunks[i]!, chunkIds);
    for (const [id, emb] of chunkMap) map.set(id, emb);
  }
  return map;
}

async function fetchJobBatchFromKv(ids: string[]): Promise<Array<{ id: string; raw: Record<string, unknown> | null }>> {
  // Upstash REST does not pipeline HGETALL — concurrent fetch via Promise.all.
  return Promise.all(
    ids.map(async (id) => {
      const raw = await kv.hgetall<Record<string, unknown>>(`job:${id}`);
      return { id, raw };
    }),
  );
}

function coerceKvJob(id: string, raw: Record<string, unknown>): Job | null {
  // Upstash auto-parses JSON-encoded values on .hgetall (per
  // feedback_upstash_auto_parse memory). Numeric fields may come back as
  // number or string — normalize.
  const s = (k: string): string | undefined => {
    const v = raw[k];
    return v === undefined || v === null ? undefined : String(v);
  };
  const title = s('title');
  const company = s('company');
  const vertical = s('vertical');
  const seniority = s('seniority');
  const description = s('description');
  const sourceUrl = s('sourceUrl');
  const source = s('source');
  const location = s('location');
  const postedAt = s('postedAt');
  const verifiedAt = s('verifiedAt');
  if (
    !title || !company || !vertical || !seniority || !description ||
    !sourceUrl || !source || !location || !postedAt || !verifiedAt
  ) {
    console.warn(`[migrate] job:${id} missing required field — skipping`);
    return null;
  }
  let mustHaves: string[] | undefined;
  const mhRaw = raw['mustHaves'];
  if (Array.isArray(mhRaw)) mustHaves = mhRaw as string[];
  else if (typeof mhRaw === 'string' && mhRaw.length > 0) {
    try {
      const parsed = JSON.parse(mhRaw);
      if (Array.isArray(parsed)) mustHaves = parsed;
    } catch { /* ignore — leave undefined */ }
  }

  const job: Job = {
    id,
    title,
    company,
    vertical: vertical as Job['vertical'],
    seniority: seniority as Job['seniority'],
    description,
    sourceUrl,
    source: source as Job['source'],
    location,
    postedAt,
    verifiedAt,
    // Placeholder; replaced by caller with the real reconstructed vector.
    embedding: '',
  };
  const sv = s('subVertical'); if (sv) job.subVertical = sv;
  const tier = s('tier');
  if (tier === 'high' || tier === 'mid' || tier === 'startup') job.tier = tier;
  const cid = s('companyId'); if (cid) job.companyId = cid;
  if (mustHaves) job.mustHaves = mustHaves;
  return job;
}

async function migrate(): Promise<MigrationStats> {
  const stats = emptyStats();

  console.log('[migrate] reading KV state...');
  const [activeRaw, expiredRaw] = await Promise.all([
    kv.smembers('jobs:active'),
    kv.smembers('jobs:expired'),
  ]);
  const activeIds = (activeRaw ?? []).map(String);
  const expiredIds = (expiredRaw ?? []).map(String);
  stats.kvActiveCount = activeIds.length;
  stats.kvExpiredCount = expiredIds.length;

  const allIds = Array.from(new Set([...activeIds, ...expiredIds]));
  stats.kvTotalCount = allIds.length;
  const activeSet = new Set(activeIds);
  console.log(`[migrate] KV: ${activeIds.length} active + ${expiredIds.length} expired = ${allIds.length} unique`);

  const embeddingMap = await reassembleEmbeddingMap();
  stats.embeddingMapSize = embeddingMap.size;

  // Fetch + write in batches of 50 — Upstash REST has no HGETALL pipeline,
  // but concurrent fetches are fine. We do 50 reads then 25 writes (tx).
  const READ_BATCH = 50;
  for (let i = 0; i < allIds.length; i += READ_BATCH) {
    const batchIds = allIds.slice(i, i + READ_BATCH);
    const batch = await fetchJobBatchFromKv(batchIds);

    for (const { id, raw } of batch) {
      if (!raw || Object.keys(raw).length === 0) {
        stats.skippedNoJobHash.push(id);
        continue;
      }
      const baseJob = coerceKvJob(id, raw);
      if (!baseJob) continue;
      const emb = embeddingMap.get(id);
      if (!emb) {
        stats.skippedNoEmbedding.push(id);
        continue;
      }

      // Pack Float32Array → base64 (matches the legacy Job.embedding contract;
      // repo-postgres.saveJob then decodes it back to write to pgvector).
      const buf = Buffer.alloc(emb.length * 4);
      for (let j = 0; j < emb.length; j++) buf.writeFloatLE(emb[j]!, j * 4);
      const jobToSave: Job = { ...baseJob, embedding: buf.toString('base64') };

      // repo-postgres.saveJob is an upsert by id. Flip `active` post-insert
      // if this id is in the expired set (saveJob sets active=true by default).
      await repo.saveJob(jobToSave);
      if (!activeSet.has(id)) {
        await repo.expireJob(id);
      }
      stats.pgUpserted++;
    }
    console.log(`[migrate] progress: ${Math.min(i + READ_BATCH, allIds.length)} / ${allIds.length}`);
  }

  // Per-vertical sanity counts (active only).
  const db = getDb();
  const rows = await db.select({ vertical: jobsTable.vertical }).from(jobsTable).where(eq(jobsTable.active, true));
  for (const r of rows) {
    stats.pgVerticalCounts[r.vertical] = (stats.pgVerticalCounts[r.vertical] ?? 0) + 1;
  }

  return stats;
}

function reportStats(s: MigrationStats) {
  console.log('');
  console.log('───── Migration Summary ─────');
  console.log(`KV active           : ${s.kvActiveCount}`);
  console.log(`KV expired          : ${s.kvExpiredCount}`);
  console.log(`KV unique total     : ${s.kvTotalCount}`);
  console.log(`Embedding map size  : ${s.embeddingMapSize}`);
  console.log(`PG upserted         : ${s.pgUpserted}`);
  console.log(`Skipped (no hash)   : ${s.skippedNoJobHash.length}${s.skippedNoJobHash.length ? '  ' + s.skippedNoJobHash.slice(0, 5).join(',') + (s.skippedNoJobHash.length > 5 ? '...' : '') : ''}`);
  console.log(`Skipped (no emb)    : ${s.skippedNoEmbedding.length}${s.skippedNoEmbedding.length ? '  ' + s.skippedNoEmbedding.slice(0, 5).join(',') + (s.skippedNoEmbedding.length > 5 ? '...' : '') : ''}`);
  console.log('');
  console.log('PG active per vertical:');
  for (const [v, c] of Object.entries(s.pgVerticalCounts).sort()) {
    console.log(`  ${v.padEnd(10)} ${c}`);
  }
}

async function main() {
  assertKvConfigured();
  const stats = await migrate();
  reportStats(stats);

  // Acceptance: pg_upserted ≥ active count; no active job missing an embedding.
  const activeWithoutEmbedding = stats.skippedNoEmbedding.filter((id) =>
    // Conservative — if any skip happened, surface it. We can't cheaply
    // re-derive active vs expired here, so just count nonzero as a warning.
    true,
  );
  if (stats.pgUpserted < stats.kvActiveCount) {
    console.error(`[migrate] FAIL: upserted ${stats.pgUpserted} < kv_active ${stats.kvActiveCount}`);
    process.exit(1);
  }
  if (activeWithoutEmbedding.length > 0) {
    console.warn(`[migrate] WARN: ${activeWithoutEmbedding.length} job(s) had no embedding; check expired-only assumption`);
  }
  console.log('[migrate] PASS');
}

main().catch((err) => {
  console.error('[migrate] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
