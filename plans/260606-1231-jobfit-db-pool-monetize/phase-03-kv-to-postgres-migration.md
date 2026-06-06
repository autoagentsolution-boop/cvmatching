# Phase 03 — KV → Postgres Migration Script

## Context Links

- Research: [research/neon-pgvector-vercel-2026.md](./research/neon-pgvector-vercel-2026.md)
- Source: KV namespaces `job:*`, `embeddings:active:*` (see `src/lib/jobs/repo.ts` header)
- Target: Postgres `jobs` table (Phase 01)
- Repo facade: Phase 02 `repo-postgres.saveJob`

## Overview

- Priority: P1
- Status: pending
- Effort: 3-4h
- Blocks: 04, 08
- Blocked by: 01, 02

One-shot script that reads all 171 (+ any expired) jobs from KV plus the active embeddings blob, reconstructs Float32Array per job, writes to Postgres. Verifies round-trip. KV is NOT deleted in this phase (Phase 8).

## Key Insights

- Embedding blob is a flat Float32Array sliced into chunks per `pack-embeddings.ts`. `loadBlobChunks` already reassembles it; reuse that for the read side.
- For each KV job: combine its Hash fields + the corresponding 768-vec slice → insert into Postgres.
- Use a Drizzle transaction with `INSERT ... ON CONFLICT (id) DO UPDATE` so the script is rerunnable.
- Active vs expired: read `jobs:active` SET; insert with `active=true`. Read `jobs:expired` SET; insert with `active=false`.
- Run via `pnpm tsx scripts/migrate-kv-to-postgres.ts` locally with prod env (`vercel env pull .env.migrate`).

## Requirements

**Functional:**
- Idempotent — re-running produces zero changes if state is identical.
- Audit log: counts of {kv_total, kv_with_embedding, pg_inserted, pg_updated, pg_skipped_no_embedding}.
- Verify step: random sample of 10 jobs → compare KV.hgetall vs Postgres SELECT field-by-field; embedding bytes match.

**Non-functional:**
- Single run completes in ≤2 min for current 171 jobs (and ≤10 min headroom for 2K).
- Reads KV in batches of 50; writes Postgres in batches of 25 inside a tx.

## Architecture

```
KV (Upstash REST)
  ├─ SMEMBERS jobs:active  → activeIds
  ├─ SMEMBERS jobs:expired → expiredIds
  ├─ HGETALL job:{id}      → 171 × hash
  └─ embeddings:active:current → vN
       └─ loadBlobChunks(vN) → { ids[], chunks[Buffer] }
                                  ↓ unpackAllChunks
                                  Map<id, Float32Array(768)>

  ↓ combine per id

  for each Job j:
    if !embeddingMap.has(j.id): skip + log
    else: insert into Postgres { ...j, embedding: vec, active: activeIds.has(j.id) }

  ↓ verify

  Random sample 10 ids:
    compare KV hgetall vs Postgres row + embedding round-trip
```

## Related Code Files

**To create:**
- `cv-ex-refactor/scripts/migrate-kv-to-postgres.ts` — the migration runner.
- `cv-ex-refactor/scripts/verify-kv-pg-parity.ts` — standalone audit (callable post-migration, post-cutover).

**To modify:**
- `cv-ex-refactor/package.json` — add `db:migrate-from-kv` script.

**To delete:** none in this phase.

## Implementation Steps

1. **Read KV state:**
   ```ts
   const activeIds = await kv.smembers('jobs:active');
   const expiredIds = await kv.smembers('jobs:expired');
   const allIds = [...new Set([...activeIds, ...expiredIds])];
   ```

2. **Reassemble embedding map** (reuse Phase 0 code while it still exists):
   ```ts
   import { loadBlobChunks } from '@/lib/jobs/repo';
   import { unpackAllChunks } from '@/lib/jobs/pack-embeddings';
   const version = await kv.get<string>('embeddings:active:current');
   const { ids, chunks } = await loadBlobChunks(version);
   // ... unpackAllChunks already returns Map<id, Float32Array>
   ```

3. **Fetch jobs in batches of 50:** Promise.all over `kv.hgetall(\`job:${id}\`)`.

4. **Write to Postgres in tx batches of 25:**
   ```ts
   await db.transaction(async (tx) => {
     await tx.insert(jobs).values(rows)
       .onConflictDoUpdate({ target: jobs.id, set: { ...partial, verifiedAt: sql`excluded.verified_at` } });
   });
   ```

5. **Skipped-no-embedding handling:** Log id + reason. Surface count at end. Likely zero for current state; defensive.

6. **Verify step:**
   - Pick 10 random ids.
   - For each: KV `hgetall` → Postgres `SELECT *` → compare every Job field.
   - Embedding: read pgvector → decode to Float32Array → compare bytewise to KV-reconstructed vec. Max abs delta < 1e-6 (float→string→float roundtrip allowance).
   - Exit non-zero if any mismatch.

7. **Run procedure** (operator):
   ```powershell
   cd C:\Users\Vincere\Desktop\Claude\CVMatching\cv-ex-refactor
   vercel env pull .env.migrate --environment=production
   pnpm tsx scripts/migrate-kv-to-postgres.ts --env-file .env.migrate
   pnpm tsx scripts/verify-kv-pg-parity.ts --env-file .env.migrate
   ```

8. **Sanity dashboard:** After run, query `SELECT vertical, COUNT(*) FROM jobs WHERE active GROUP BY vertical` and paste into a comment on the migration commit.

## Todo List

- [ ] Write scripts/migrate-kv-to-postgres.ts
- [ ] Write scripts/verify-kv-pg-parity.ts
- [ ] Add db:migrate-from-kv to package.json
- [ ] Dry-run against dev DB with mock KV → verify counts
- [ ] Run against prod (pull env, execute, verify)
- [ ] Record per-vertical counts in commit message
- [ ] Open Phase 04 PR referencing migration commit hash

## Success Criteria

- Migration exits 0; reports `pg_inserted >= kv_active_count`.
- `pg_skipped_no_embedding == 0` for active set (acceptable >0 for expired).
- Verification audit on 10 random ids passes (zero field mismatches; embedding delta <1e-6).
- Per-vertical count in Postgres equals KV vertical-index for active set.

## Risk Assessment

| # | Risk | L | I | Mit |
|---|---|---|---|---|
| 1 | KV `kv.hgetall` returns string-cast numbers/bools (Upstash auto-parse quirk) | H | M | Coerce in script: `Number(raw.someNumeric)`, `raw.active === 'true'`; covered by verify step |
| 2 | Embedding bytes deviate >1e-6 due to base64 → Float32 path | L | M | Compare normalized vectors (re-L2 both sides before delta check) |
| 3 | Live ingest writes to KV during migration → drift | L | M | Pause cron during migration window (toggle `INGEST_CRON_ENABLED=false`); ~5 min window |
| 4 | Postgres tx batches exceed Neon's 5MB statement size | L | L | Keep batch=25 × ~3KB/row = 75KB; well under limit |
| 5 | onConflictDoUpdate clobbers a Postgres-only column added later | L | L | Re-run is acceptable here since this phase is one-shot |

## Security Considerations

- `vercel env pull` writes connection strings to disk → script should `unlink` `.env.migrate` on success (add to teardown).
- Never commit `.env.migrate`. Add to `.gitignore` (verify it's already covered by `.env*`).

## Rollback Plan

- Migration is additive (INSERT or UPDATE). To revert: `TRUNCATE jobs CASCADE` in Postgres; KV untouched, recommend route still reads KV (Phase 4 hasn't switched yet).
- Re-running the migration is safe due to ON CONFLICT.

## Next Steps

- Phase 04: switch recommend route to read Postgres.
- Phase 08: after stability, drop `job:*` KV keys + `vertical-index` sidecar.
