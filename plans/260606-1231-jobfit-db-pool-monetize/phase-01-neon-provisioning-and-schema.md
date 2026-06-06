# Phase 01 — Neon Provisioning + Schema + Migration Tooling

## Context Links

- Research: [research/neon-pgvector-vercel-2026.md](./research/neon-pgvector-vercel-2026.md)
- Existing: `cv-ex-refactor/src/lib/jobs/types.ts`, `cv-ex-refactor/src/lib/env.ts`
- Docs to update: `docs/system-architecture.md`, `docs/deployment.md` §13/§14

## Overview

- Priority: P1
- Status: pending
- Effort: 4-6h
- Blocks: 02, 03, all downstream

Provision Neon Postgres via Vercel Marketplace, install pgvector, define the full schema for jobs/embeddings/users/seen/subscriptions/orders/webhook_events, set up Drizzle Kit migrations.

## Key Insights

- Vercel Marketplace integration auto-injects `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` (direct) into ALL Vercel envs. No manual `vercel env add`.
- Drizzle Kit chosen over Prisma: 28× smaller bundle, sub-100ms cold start, SQL-first matches existing codebase style.
- HNSW index on `embedding vector(768)` with `vector_cosine_ops` — matches L2-normalized vectors from `embed.ts`.
- Schema lives in `cv-ex-refactor/src/db/schema.ts`; migrations in `cv-ex-refactor/drizzle/`.
- Pinned region: Singapore (`aws-ap-southeast-1`) — closest to VN users.

## Requirements

**Functional:**
- Provision Neon DB via Vercel Marketplace; verify env vars in prod + preview.
- Enable `vector` extension.
- Create 6 tables with correct constraints, indexes, foreign keys.
- Set up Drizzle Kit dev workflow (`pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`).
- Add `db` client singleton at `src/db/index.ts` using `@neondatabase/serverless` + `drizzle-orm/neon-http`.

**Non-functional:**
- Schema must satisfy existing `Job` TypeScript type from `types.ts` (no type fork).
- Pooled URL for runtime; unpooled URL for migrations only.
- All timestamps `timestamptz`.

## Architecture

```
Vercel Function (preferredRegion: sin1)
  └─ db = drizzle(neon(DATABASE_URL))
       ├─ HTTP path: db.select() — single query, lowest cold-start
       └─ tx path: db.transaction() — ingest batches, migrations

Neon Singapore (pooled :5432 / unpooled :5432 direct)
  ├─ jobs              (PK id, HNSW on embedding, b-tree on active+vertical)
  ├─ users             (PK id from NextAuth, plan column)
  ├─ user_seen_job     (composite PK userId+jobId)
  ├─ subscriptions     (PK id, user FK)
  ├─ orders            (PK id=uuid, user FK, partial index for pending)
  └─ sepay_webhook_events  (PK event_id from SePay)
```

## Related Code Files

**To create:**
- `cv-ex-refactor/src/db/schema.ts` — Drizzle schema declarations.
- `cv-ex-refactor/src/db/index.ts` — `db` singleton exports.
- `cv-ex-refactor/drizzle.config.ts` — Drizzle Kit config.
- `cv-ex-refactor/drizzle/0000_init.sql` — initial migration (Drizzle generates).
- `cv-ex-refactor/scripts/db-enable-pgvector.ts` — one-off `CREATE EXTENSION` runner.

**To modify:**
- `cv-ex-refactor/package.json` — add `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`; add scripts `db:generate`, `db:migrate`, `db:push`, `db:studio`.
- `cv-ex-refactor/src/lib/env.ts` — add `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (optional, coerced).
- `docs/system-architecture.md` — append "Postgres layer" section.
- `docs/deployment.md` §13 — note KV no longer source of truth for jobs/users.
- `docs/deployment.md` §14 — list new env vars.

**To delete:** none in this phase.

## Implementation Steps

1. **Provision Neon via Vercel Marketplace** (manual, ~5 min):
   - Vercel dashboard → Integrations → Browse Marketplace → Neon → Add.
   - Pick region `aws-ap-southeast-1`.
   - Connect to `resume-refactor` project, all envs (prod/preview/dev).
   - Confirm `DATABASE_URL` + `DATABASE_URL_UNPOOLED` appear in Settings → Environment Variables.

2. **Install deps:** `pnpm add drizzle-orm @neondatabase/serverless` and `pnpm add -D drizzle-kit`.

3. **Write `drizzle.config.ts`:**
   ```ts
   import { defineConfig } from 'drizzle-kit';
   export default defineConfig({
     schema: './src/db/schema.ts',
     out: './drizzle',
     dialect: 'postgresql',
     dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
   });
   ```

4. **Write `src/db/schema.ts`** — 6 tables per research/neon-pgvector-vercel-2026.md schema sketch. Use `pgTable`, `vector` (from drizzle-orm/pg-core ≥0.30), `jsonb`, `timestamp({ withTimezone: true })`.

5. **Write `src/db/index.ts`:**
   ```ts
   import { neon } from '@neondatabase/serverless';
   import { drizzle } from 'drizzle-orm/neon-http';
   import * as schema from './schema';
   const sql = neon(process.env.DATABASE_URL!);
   export const db = drizzle(sql, { schema });
   ```

6. **Enable pgvector:** Write + run `scripts/db-enable-pgvector.ts` calling `CREATE EXTENSION IF NOT EXISTS vector`. Use unpooled URL.

7. **Generate + apply initial migration:** `pnpm db:generate` → review SQL in `drizzle/0000_init.sql` → manually append HNSW index creation (Drizzle Kit may not emit it for `vector` type cleanly) → `pnpm db:migrate`.

8. **Add `preferredRegion = 'sin1'`** to `src/app/api/jobs/recommend/route.ts` AND any future Postgres-touching routes (Phase 4 wires the route changes).

9. **Smoke test:** Add `scripts/db-smoke.ts` that `INSERT INTO users (id, email, plan) VALUES ('test', 'a@b.c', 'free')` then SELECT it back. Run against prod; assert success; delete the row.

10. **Update docs:** `system-architecture.md` + `deployment.md` per "To modify" list.

## Todo List

- [ ] Provision Neon via Vercel Marketplace; verify env vars in 3 scopes
- [ ] Install drizzle-orm + drizzle-kit + @neondatabase/serverless
- [ ] Write drizzle.config.ts
- [ ] Write src/db/schema.ts (6 tables)
- [ ] Write src/db/index.ts singleton
- [ ] Write scripts/db-enable-pgvector.ts; run it
- [ ] Generate + edit + apply 0000_init.sql migration with HNSW index
- [ ] Add preferredRegion = 'sin1' to recommend route header
- [ ] Run scripts/db-smoke.ts; verify INSERT/SELECT/DELETE
- [ ] Update docs/system-architecture.md
- [ ] Update docs/deployment.md §13 + §14

## Success Criteria

- `pnpm db:migrate` exits 0 against prod Neon DB.
- `\d jobs` in `psql` shows HNSW index `jobs_embedding_hnsw` on `embedding` column.
- Smoke test INSERTs + SELECTs from `users` table via Vercel function (deploy a test route).
- env vars `DATABASE_URL` + `DATABASE_URL_UNPOOLED` present in `vercel env ls` for production.

## Risk Assessment

| # | Risk | L | I | Mit |
|---|---|---|---|---|
| 1 | Drizzle Kit doesn't emit `vector(768)` type cleanly | M | M | Append `CREATE INDEX ... USING hnsw` manually to generated SQL; lock generator version |
| 2 | Neon Singapore region not available at provisioning time | L | M | Fall back to `aws-ap-southeast-2` (Sydney); doc the region in deployment.md |
| 3 | HNSW build fails on empty table (pgvector ≥0.6 supports it; older versions don't) | L | L | Neon ships pgvector ≥0.7 by default; verify with `SELECT extversion FROM pg_extension WHERE extname='vector'` |
| 4 | env coercion conflict in `src/lib/env.ts` (memory: `env.ts coercion fix`) | M | L | Add as optional string; do not enforce — Vercel Marketplace injects only in cloud, not local pnpm dev |

## Security Considerations

- `DATABASE_URL` is a connection string with embedded password. Never log it. Vercel marks it sensitive automatically.
- No PII in schema yet (users.email is the only identifier; Google OAuth user IDs are opaque).
- `sepay_webhook_events.payload` may contain bank account numbers — flag for future encryption-at-rest if SePay payloads include masked account data.

## Rollback Plan

- Code-only rollback: `git revert` the schema commit; `drizzle-kit drop` the migration; Vercel Marketplace integration can be removed (deletes DB on confirm).
- Until Phase 4 starts using Postgres in the hot path, KV remains source of truth and this phase has zero production impact.

## Next Steps

- Phase 02 builds the data-access layer on top of this schema.
- Phase 03 writes the migration script to copy 171 KV jobs in.
