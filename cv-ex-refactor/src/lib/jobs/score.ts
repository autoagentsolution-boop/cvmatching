import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { loadBlobChunks } from './repo';
import { unpackAllChunks } from './pack-embeddings';

const MEMO_TTL_MS = 60_000; // 60s revalidate window
const BYTES_PER_ENTRY = 768 * 4; // Float32 × 768 dims

interface EmbeddingsMemo {
  version: string;
  vecs: Map<string, Float32Array>;
  loadedAt: number;
}

// Module-scope memo — survives across requests on same Vercel instance.
let memCache: EmbeddingsMemo | null = null;

export class JobIndexNotReadyError extends Error {
  constructor() {
    super('Job index not ready — embeddings blob not found in KV');
    this.name = 'JobIndexNotReadyError';
  }
}

/**
 * Cosine similarity between two 768-dim vectors.
 * Vectors are L2-normalized at embed time (see embed.ts), so dot product == cosine.
 */
export function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < 768; i++) {
    dot += a[i]! * b[i]!;
  }
  return dot;
}

/**
 * Load embeddings blob into module memory, revalidating at most every 60s.
 * Throws JobIndexNotReadyError when KV has no active version.
 */
export async function getEmbeddingsMemo(): Promise<EmbeddingsMemo> {
  const now = Date.now();

  if (memCache && now - memCache.loadedAt < MEMO_TTL_MS) {
    return memCache;
  }

  if (!kvAvailable) {
    throw new JobIndexNotReadyError();
  }

  const version = await kv.get<string>('embeddings:active:current');
  if (!version) {
    memCache = null;
    throw new JobIndexNotReadyError();
  }

  // Version unchanged → refresh timestamp only, skip blob re-load.
  if (memCache?.version === version) {
    memCache.loadedAt = now;
    return memCache;
  }

  // First load or version rotated — fetch blob from KV.
  const { ids, chunks } = await loadBlobChunks(version);

  // ids is the flat list of ALL job ids in order.
  // Each Buffer holds (byteLength / BYTES_PER_ENTRY) entries.
  // Split flat ids into per-chunk slices to align with unpackAllChunks expectations.
  const idsByChunk: string[][] = [];
  let cursor = 0;
  for (const chunk of chunks) {
    const count = chunk.byteLength / BYTES_PER_ENTRY;
    idsByChunk.push(ids.slice(cursor, cursor + count));
    cursor += count;
  }

  const vecs = unpackAllChunks(chunks, idsByChunk);
  memCache = { version, vecs, loadedAt: now };
  return memCache;
}

/**
 * Return top-k job ids sorted descending by cosine similarity to query.
 */
export async function topKCandidates(
  query: Float32Array,
  k = 20,
): Promise<Array<{ id: string; score: number }>> {
  const { vecs } = await getEmbeddingsMemo();

  const scores: Array<{ id: string; score: number }> = [];
  for (const [id, emb] of vecs) {
    scores.push({ id, score: cosineSim(query, emb) });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k);
}
