// Sidecar KV index mapping vertical → set of active job ids. Updated on
// saveJob/expireJob so the recommend route can filter candidates by vertical
// with a single KV read (~50ms) instead of fanning out to per-job hgetall.
//
// Storage shape: `jobs:by-vertical` = JSON record { tech: ["id1", ...], ... }.

import { kv, kvAvailable } from '@/lib/quota/kv-client';
import type { Job, Vertical } from './types';
import { listActiveIds, getJobBatch } from './repo';

export const VERTICAL_INDEX_KEY = 'jobs:by-vertical';

type VerticalIndex = Partial<Record<Vertical, string[]>>;

const CACHE_TTL_MS = 5_000;
let cached: { value: VerticalIndex; expiresAt: number } | null = null;

export function resetVerticalIndexCache(): void {
  cached = null;
}

/**
 * Read the vertical index. Fail-open: any KV error returns an empty index
 * (caller falls back to no filter — full pool).
 */
export async function getVerticalIndex(): Promise<VerticalIndex> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (!kvAvailable) {
    cached = { value: {}, expiresAt: now + CACHE_TTL_MS };
    return {};
  }
  try {
    const raw = await kv.get<unknown>(VERTICAL_INDEX_KEY);
    let value: VerticalIndex = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      value = raw as VerticalIndex;
    } else if (typeof raw === 'string') {
      value = JSON.parse(raw) as VerticalIndex;
    }
    cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch {
    cached = { value: {}, expiresAt: now + CACHE_TTL_MS };
    return {};
  }
}

/** Get the active-job-id set for a vertical from the index, or null when absent. */
export async function getJobIdsForVertical(vertical: Vertical): Promise<Set<string> | null> {
  const idx = await getVerticalIndex();
  const ids = idx[vertical];
  if (!ids || ids.length === 0) return null;
  return new Set(ids);
}

/** Bulk-write the index in one shot. Used by backfill + migration scripts. */
export async function writeVerticalIndex(idx: VerticalIndex): Promise<void> {
  if (!kvAvailable) return;
  await kv.set(VERTICAL_INDEX_KEY, JSON.stringify(idx));
  resetVerticalIndexCache();
}

/**
 * Scan active jobs from repo, group by vertical, persist as index.
 * Expensive (1 smembers + N hgetalls). NOT for request hot-path —
 * call from CLI / admin endpoint after ingest or refresh.
 * Returns the newly-built index.
 */
export async function backfillVerticalIndex(): Promise<VerticalIndex> {
  if (!kvAvailable) return {};
  const ids = await listActiveIds();
  if (ids.length === 0) {
    await writeVerticalIndex({});
    return {};
  }
  const jobs: Job[] = await getJobBatch(ids);
  const idx: VerticalIndex = {};
  for (const j of jobs) {
    const v = j.vertical;
    if (!idx[v]) idx[v] = [];
    idx[v]!.push(j.id);
  }
  await writeVerticalIndex(idx);
  return idx;
}

/** Delete the persisted index + reset cache. Forces next read to return empty (fail-open). */
export async function invalidateVerticalIndex(): Promise<void> {
  resetVerticalIndexCache();
  if (kvAvailable) await kv.del(VERTICAL_INDEX_KEY);
}
