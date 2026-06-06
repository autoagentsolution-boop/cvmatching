// JobsRepo interface — abstracts over the legacy KV repo and the new Postgres
// repo so callers can be swapped at one site (the import) during cutover.
//
// Phase 4 of the jobfit-db-pool-monetize plan flips recommend-route imports
// from `./repo` to `./repo-postgres`. Until then both implementations coexist;
// after Phase 8 cutover the KV impl is deleted.

import type { Job, Vertical } from './types';

export interface TopKOpts {
  /** Filter by vertical bucket before HNSW ranking. */
  vertical?: Vertical;
  /**
   * Small list of jobIds to exclude (e.g., client-supplied "just-seen" ids
   * for anon users whose dedup is sessionStorage-based). Pushed down as
   * `id <> ALL($exclude)` so the planner skips them at the scan stage.
   */
  excludeIds?: string[];
  /**
   * Signed-in user id whose `user_seen_job` entries should be NOT-EXISTSed
   * out of the result set. Server-side persistent dedup. Mutually compatible
   * with `excludeIds` (both applied).
   */
  excludeForUserId?: string;
  /** Max results returned. Hard upper bound for the recommend endpoint. */
  k: number;
}

export interface TopKResult {
  id: string;
  /** Cosine similarity in [-1, 1]; higher = better match. */
  score: number;
}

/**
 * The repository contract. Implementations:
 * - `./repo.ts` — legacy KV (kept until Phase 8).
 * - `./repo-postgres.ts` — Drizzle + pgvector (primary going forward).
 */
export interface JobsRepo {
  getJob(id: string): Promise<Job | null>;
  getJobBatch(ids: string[]): Promise<Job[]>;
  saveJob(job: Job): Promise<void>;
  expireJob(id: string): Promise<void>;
  isActiveJob(id: string): Promise<boolean>;
  listActiveIds(): Promise<string[]>;
  touchVerifiedAt(id: string, iso: string): Promise<void>;
  /**
   * HNSW-ranked nearest neighbours by cosine similarity. Query vector is
   * L2-normalized Float32Array (Gemini gemini-embedding-001 output).
   */
  topKByEmbedding(query: Float32Array, opts: TopKOpts): Promise<TopKResult[]>;
}
