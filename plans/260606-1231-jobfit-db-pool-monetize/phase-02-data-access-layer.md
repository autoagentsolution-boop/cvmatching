# Phase 02 — Data-Access Layer (Jobs Repo over Postgres)

## Context Links

- Research: [research/neon-pgvector-vercel-2026.md](./research/neon-pgvector-vercel-2026.md)
- Current KV repo: `cv-ex-refactor/src/lib/jobs/repo.ts`, `vertical-index.ts`, `score.ts`
- Type contract: `cv-ex-refactor/src/lib/jobs/types.ts`

## Overview

- Priority: P1
- Status: pending
- Effort: 5-7h
- Blocks: 03, 04, 05
- Blocked by: 01

Build a Postgres-backed jobs repository that exposes the SAME function surface as the KV repo. Cutover is a one-line swap of imports in callers. No type changes.

## Key Insights

- Define an interface `JobsRepo` so both KV and Postgres impls coexist during cutover.
- Postgres impl uses Drizzle for typed queries; pgvector ops via raw SQL fragments (`sql\`embedding <=> ${vec}::vector\``).
- Embedding stored as `vector(768)` column — bytewise compatible with Float32Array.
- DROP the embedding blob chunk machinery (`pack-embeddings.ts`, `loadBlobChunks`, `getEmbeddingsMemo`) — pgvector replaces it.
- `topKCandidates` becomes a SQL query with `ORDER BY embedding <=> $1 LIMIT k`.
- `getJobIdsForVertical` becomes `SELECT id FROM jobs WHERE active AND vertical=$1` — no sidecar needed; index handles it.
- `vertical-index.ts` is DELETED in Phase 8 cutover; here we just bypass it.

## Requirements

**Functional:**
- `JobsRepo` interface: `getJob`, `getJobBatch`, `saveJob`, `expireJob`, `isActiveJob`, `listActiveIds`, `touchVerifiedAt`, `topKByEmbedding(query, k, opts)`.
- Postgres impl: `src/lib/jobs/repo-postgres.ts`.
- Keep KV impl alive in `repo.ts` until Phase 8 (for read fallback + emergency rollback).
- `topKByEmbedding(query, k, { vertical?, excludeIds?, userId? })` — single SQL with optional WHERE clauses.

**Non-functional:**
- p95 query latency ≤200ms from Vercel sin1 for k=10 / pool=2K.
- Float32Array ↔ pgvector serialization must round-trip exactly (no precision loss beyond IEEE-754).

## Architecture

```
caller (recommend route, ingest script)
  ↓
JobsRepo (interface in repo-interface.ts)
  ├─ repo-postgres.ts (new, primary)
  │   ↓
  │  db.select() + raw SQL for vector ops
  │   ↓
  │  Neon Postgres + pgvector
  │
  └─ repo.ts (legacy KV, kept until Phase 8)
```

## Related Code Files

**To create:**
- `cv-ex-refactor/src/lib/jobs/repo-interface.ts` — `JobsRepo` TS interface + `TopKOpts` type.
- `cv-ex-refactor/src/lib/jobs/repo-postgres.ts` — Drizzle-based implementation.
- `cv-ex-refactor/src/lib/jobs/vector-codec.ts` — `Float32Array → pgvector literal string` + back.

**To modify:**
- `cv-ex-refactor/src/lib/jobs/types.ts` — no change (already has all fields needed).
- `cv-ex-refactor/src/lib/jobs/repo.ts` — add `implements JobsRepo` annotation; no behavior change.

**To delete in Phase 8 (not here):**
- `cv-ex-refactor/src/lib/jobs/pack-embeddings.ts`
- `cv-ex-refactor/src/lib/jobs/embed-cache.ts` — STAY (KV-resident, not migrated)
- `cv-ex-refactor/src/lib/jobs/vertical-index.ts`
- `cv-ex-refactor/src/lib/jobs/score.ts` (memo+cosineSim path — pgvector replaces it)

## Implementation Steps

1. **Define `repo-interface.ts`:**
   ```ts
   export interface TopKOpts {
     vertical?: Vertical;
     excludeIds?: string[];      // explicit list (small)
     excludeForUserId?: string;  // server-side NOT EXISTS user_seen_job
     k: number;
   }
   export interface TopKResult { id: string; score: number; }
   export interface JobsRepo {
     getJob(id: string): Promise<Job | null>;
     getJobBatch(ids: string[]): Promise<Job[]>;
     saveJob(job: Job): Promise<void>;
     expireJob(id: string): Promise<void>;
     isActiveJob(id: string): Promise<boolean>;
     listActiveIds(): Promise<string[]>;
     touchVerifiedAt(id: string, iso: string): Promise<void>;
     topKByEmbedding(query: Float32Array, opts: TopKOpts): Promise<TopKResult[]>;
   }
   ```

2. **Write `vector-codec.ts`:**
   - `float32ToPgVector(emb: Float32Array): string` → `'[0.123,-0.456,...]'`.
   - `pgVectorToFloat32(s: string): Float32Array` → parse + Float32Array.from.
   - Round-trip test in vitest: 100 random vectors, max abs delta < 1e-7.

3. **Write `repo-postgres.ts`:**
   - Implement each method via Drizzle.
   - `topKByEmbedding`: raw SQL with sql tag:
     ```ts
     const rows = await db.execute(sql`
       SELECT id, 1 - (embedding <=> ${queryLit}::vector) AS score
       FROM jobs
       WHERE active = true
         ${opts.vertical ? sql`AND vertical = ${opts.vertical}` : sql``}
         ${opts.excludeForUserId ? sql`AND NOT EXISTS (
           SELECT 1 FROM user_seen_job
           WHERE user_id = ${opts.excludeForUserId} AND job_id = jobs.id
         )` : sql``}
       ORDER BY embedding <=> ${queryLit}::vector
       LIMIT ${opts.k};
     `);
     ```
   - Use `embedding` Drizzle column type with custom from/to via `customType<{ data: Float32Array, driverData: string }>`.

4. **Add `excludeIds` small-list variant** for anon users where dedup is client-side but the caller may pass a few "just-seen" ids:
   ```ts
   if (opts.excludeIds?.length) sql`AND id <> ALL(${opts.excludeIds})`
   ```

5. **Update `repo.ts`** to declare `: JobsRepo` (interface compat check only).

6. **Vitest unit tests** in `src/lib/jobs/__tests__/repo-postgres.test.ts`:
   - Save 5 fake jobs with random 768-vectors → topK with random query → assert order matches manual cosine.
   - Save 1 job, expireJob, isActiveJob → false.
   - excludeForUserId: insert into user_seen_job, query → ensure that id absent from results.

7. **Local dev**: hit Neon via `DATABASE_URL_UNPOOLED` for tests; CI/Vercel uses pooled. Tests run with `dotenv` of `.env.test` pointing to a Neon branch (one-time create per dev).

## Todo List

- [ ] Write src/lib/jobs/repo-interface.ts
- [ ] Write src/lib/jobs/vector-codec.ts + round-trip test
- [ ] Write src/lib/jobs/repo-postgres.ts implementing all methods
- [ ] Annotate legacy repo.ts with `implements JobsRepo`
- [ ] Write repo-postgres.test.ts (topK ordering, exclude, save/expire)
- [ ] Verify HNSW index hit via EXPLAIN ANALYZE on dev DB
- [ ] Document module API in docs/code-standards.md (Jobs domain)

## Success Criteria

- All 8 interface methods implemented + green tests.
- `EXPLAIN ANALYZE` on topK query shows `Index Scan using jobs_embedding_hnsw`.
- p95 topK latency ≤200ms for k=10 against 2K-row dev DB.
- Round-trip Float32Array → pgvector → Float32Array: max abs error < 1e-7.

## Risk Assessment

| # | Risk | L | I | Mit |
|---|---|---|---|---|
| 1 | Drizzle `customType<vector>` doesn't survive `sql` raw fragments | M | M | Use raw SQL for vector ops; Drizzle ORM only for non-vector queries; document the split |
| 2 | HNSW recall drops below 90% after 2K inserts | L | H | `SET LOCAL hnsw.ef_search = 80` per query if recall drops; rebuild index post-migration |
| 3 | Cold-start regression (Drizzle import adds ~50ms) | L | L | Tree-shake unused tables from runtime imports; Drizzle's pure-ESM minimizes this |
| 4 | NOT EXISTS subquery slows topK on heavy users (many seen jobs) | M | M | Index `user_seen_job (user_id, job_id)` (already in schema as PK); flip to LEFT JOIN ... WHERE NULL if EXPLAIN shows nested-loop |

## Security Considerations

- All queries parameterized via Drizzle's `sql` tag — no string concat of user input.
- `excludeForUserId` accepts JWT-verified user id only; never trust client-passed userId.
- `getJobBatch` returns full job records — make sure callers don't leak admin-only fields (none today).

## Rollback Plan

- New files isolated. `git revert` the phase commit; remove the new files; legacy KV repo untouched.
- No data state change in this phase (no INSERTs to Postgres yet — those are Phase 3).

## Next Steps

- Phase 03 writes the migration script using `repo-postgres.saveJob` to copy KV data in.
- Phase 04 swaps recommend-route imports from `./repo` to `./repo-postgres`.
