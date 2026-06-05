// Typed KV wrappers for the Company domain.
// All keys namespaced `co-*` to avoid collision with `job:*`, `q:*`, `kill-switch:*`.
// Fail-loud on KV unavailability — this module is consumed by ingest pipeline
// + admin routes which both require KV.
//
// Key inventory (mirror in docs/deployment.md §13 when shipping):
//   co:{slug}                              JSON Company record (no TTL — app enforces tier1ExpiresAt)
//   co-alias:{normalizedName}              STRING slug (reverse index; no TTL)
//   co-ratings:{slug}                      JSON ExternalRatings (7d TTL)
//   co-dedup-queue:{slug}-{candidateSlug}  JSON DedupQueueEntry (30d TTL)
//   co-enrich-calls:{YYYY-MM}              counter (60d TTL, abuse guard)
//   co-index                               SET of all minted slugs (for cron/refresh fan-out)
//   co-active-jobs:{slug}                  SET of active job ids referencing this company

import { kv, kvAvailable } from '@/lib/quota/kv-client';
import type {
  Company,
  DedupQueueEntry,
  ExternalRatings,
} from './types';

const RATINGS_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEDUP_QUEUE_TTL_SECONDS = 30 * 24 * 60 * 60;
const ENRICH_CALLS_TTL_SECONDS = 60 * 24 * 60 * 60;

function assertKv(): void {
  if (!kvAvailable) {
    throw new Error(
      'KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in .env.local',
    );
  }
}

export async function getCompany(slug: string): Promise<Company | null> {
  assertKv();
  return (await kv.get<Company>(`co:${slug}`)) ?? null;
}

export async function setCompany(company: Company): Promise<void> {
  assertKv();
  await kv.set(`co:${company.slug}`, company);
  await kv.sadd('co-index', company.slug);
}

/** Batch fetch — uses parallel `get` since @vercel/kv has no JSON-mget. */
export async function getCompanyBatch(slugs: string[]): Promise<Company[]> {
  assertKv();
  if (slugs.length === 0) return [];
  const results = await Promise.all(
    slugs.map((s) =>
      kv
        .get<Company>(`co:${s}`)
        .then((c) => c ?? null)
        .catch(() => null),
    ),
  );
  return results.filter((c): c is Company => c !== null);
}

export async function listAllSlugs(): Promise<string[]> {
  assertKv();
  return (await kv.smembers('co-index')) as string[];
}

export async function getAlias(normalizedName: string): Promise<string | null> {
  assertKv();
  if (!normalizedName) return null;
  return (await kv.get<string>(`co-alias:${normalizedName}`)) ?? null;
}

/**
 * Atomically set alias if missing. Returns the slug the alias now points to —
 * always the LOSER of a race reads the WINNER's slug. Idempotent re-write of
 * the same slug is silently OK.
 */
export async function setAliasIfAbsent(
  normalizedName: string,
  slug: string,
): Promise<string> {
  assertKv();
  const ok = await kv.set(`co-alias:${normalizedName}`, slug, { nx: true });
  if (ok === 'OK') return slug;
  const existing = await kv.get<string>(`co-alias:${normalizedName}`);
  return existing ?? slug;
}

export async function getRatings(slug: string): Promise<ExternalRatings | null> {
  assertKv();
  return (await kv.get<ExternalRatings>(`co-ratings:${slug}`)) ?? null;
}

export async function setRatings(slug: string, ratings: ExternalRatings): Promise<void> {
  assertKv();
  await kv.set(`co-ratings:${slug}`, ratings, { ex: RATINGS_TTL_SECONDS });
}

export async function enqueueDedup(
  entry: DedupQueueEntry & { candidateSlug: string },
): Promise<void> {
  assertKv();
  const slug = entry.normalizedName.replace(/\s+/g, '-');
  const key = `co-dedup-queue:${slug}-${entry.candidateSlug}`;
  await kv.set(key, entry, { ex: DEDUP_QUEUE_TTL_SECONDS });
}

export async function listDedupQueue(): Promise<DedupQueueEntry[]> {
  assertKv();
  const keys: string[] = [];
  let cursor: string = '0';
  do {
    const [next, batch] = (await kv.scan(cursor, {
      match: 'co-dedup-queue:*',
      count: 100,
    })) as [string, string[]];
    keys.push(...batch);
    cursor = next;
  } while (cursor !== '0' && keys.length < 500);

  if (keys.length === 0) return [];
  const entries = await Promise.all(
    keys.map((k) => kv.get<DedupQueueEntry>(k).catch(() => null)),
  );
  return entries.filter((e): e is DedupQueueEntry => e !== null);
}

export async function clearDedupEntry(
  normalizedName: string,
  candidateSlug: string,
): Promise<void> {
  assertKv();
  const slug = normalizedName.replace(/\s+/g, '-');
  await kv.del(`co-dedup-queue:${slug}-${candidateSlug}`);
}

export async function incrEnrichCalls(ymKey: string): Promise<number> {
  assertKv();
  const key = `co-enrich-calls:${ymKey}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, ENRICH_CALLS_TTL_SECONDS);
  return count;
}

/** Track which jobs reference a company — used by weekly cron to scope LLM enrichment. */
export async function addActiveJob(slug: string, jobId: string): Promise<void> {
  assertKv();
  await kv.sadd(`co-active-jobs:${slug}`, jobId);
}

export async function removeActiveJob(slug: string, jobId: string): Promise<void> {
  assertKv();
  await kv.srem(`co-active-jobs:${slug}`, jobId);
}

export async function listActiveJobsForCompany(slug: string): Promise<string[]> {
  assertKv();
  return (await kv.smembers(`co-active-jobs:${slug}`)) as string[];
}

/**
 * Lookup candidate companies via prefix scan over alias namespace. Hot path —
 * limit 200 results to bound LLM dedup ranker input size.
 */
export async function findCandidatesByPrefix(prefix: string, limit = 200): Promise<string[]> {
  assertKv();
  if (!prefix) return [];
  const keys: string[] = [];
  let cursor: string = '0';
  do {
    const [next, batch] = (await kv.scan(cursor, {
      match: `co-alias:${prefix}*`,
      count: 100,
    })) as [string, string[]];
    keys.push(...batch);
    cursor = next;
    if (keys.length >= limit) break;
  } while (cursor !== '0');

  if (keys.length === 0) return [];
  const slugs = await Promise.all(
    keys.slice(0, limit).map((k) => kv.get<string>(k).catch(() => null)),
  );
  const unique = new Set<string>();
  for (const s of slugs) if (s) unique.add(s);
  return [...unique];
}
