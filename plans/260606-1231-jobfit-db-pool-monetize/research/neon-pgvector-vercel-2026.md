# Research R1 — Neon Postgres + pgvector on Vercel (2026 state)

**Date:** 2026-06-06
**For:** plan `260606-1231-jobfit-db-pool-monetize`
**Sources:** Neon docs, Vercel Marketplace, pgvector benchmarks, Drizzle/Prisma comparisons (see end).

---

## Recommendation summary

| Decision | Pick | Reason |
|---|---|---|
| Provisioning | Vercel Marketplace → Neon | Auto-injects `DATABASE_URL` + `DATABASE_URL_UNPOOLED` into all envs (prod/preview/dev). No manual env wiring. |
| Driver | `@neondatabase/serverless` (HTTP for queries, ws for tx) | Vercel Functions on Node runtime; HTTP one-shot for recommend queries (lowest latency); ws for migrations + multi-stmt tx. |
| Pooler | Neon built-in PgBouncer (port 5432 pooled URL) | No separate Supavisor/PgBouncer infra. `DATABASE_URL` is pooled by default; `DATABASE_URL_UNPOOLED` for migrations only. |
| Migration tool | **Drizzle Kit** | 28× smaller bundle than Prisma 7 (57KB vs 1.6MB); cold start <500ms vs 1-3s; native Neon serverless driver compat; SQL-first matches project's existing code style (raw KV calls, no ORM). |
| Vector index | **HNSW** | Project pool target 1-2K → 10K eventually. HNSW better recall, log-time search, absorbs inserts without rebuild. IVFFlat only wins for >10M static. |
| Embedding dim | 768 (unchanged) | Matches existing Gemini gemini-embedding-001 outputDimensionality=768 in `src/lib/jobs/embed.ts`. No migration of the embed pipeline. |

## Architecture

```
Vercel Function (Node)
  ↓ HTTP (single query)        ↓ WebSocket (tx, migrations)
  @neondatabase/serverless drizzle-orm
  ↓
  Neon serverless (region: aws-ap-southeast-1, Singapore)
  ↓ pgbouncer pooled :5432
  Postgres + pgvector ext
```

- Region: **aws-ap-southeast-1 (Singapore)** — closest to Vietnamese user base + matches Vercel `iad1` fallback latency budget for the recommend p95 ≤25s ceiling.
- HTTP query path: `neon(sql)` from `@neondatabase/serverless` — single fetch per query, ~30-80ms p50 from Vercel Singapore region.
- Transaction path: `neon.transaction(...)` over WebSocket — only used for migrations + multi-row insert batches in ingest.

## Schema sketch

```sql
-- v1 migration (Drizzle Kit generated)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE jobs (
  id          text PRIMARY KEY,             -- sha256(sourceUrl).slice(0,16)
  title       text NOT NULL,
  company     text NOT NULL,
  vertical    text NOT NULL,                -- 'tech'|'marketing'|'finance'|'sales'|'ops'|'other'
  sub_vertical text,
  seniority   text NOT NULL,                -- 'intern'|'junior'|'mid'|'senior'|'lead'
  tier        text,                          -- 'high'|'mid'|'startup' company-tier
  description text NOT NULL,
  source_url  text UNIQUE NOT NULL,
  source      text NOT NULL,                -- 'itviec'|'topcv'|'vnw'|'vl24h'|'other'
  location    text NOT NULL,
  posted_at   timestamptz NOT NULL,
  verified_at timestamptz NOT NULL,
  must_haves  jsonb,                         -- string[] | null
  company_id  text,
  active      boolean NOT NULL DEFAULT true,
  embedding   vector(768) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_active_vertical_idx ON jobs (active, vertical) WHERE active = true;
CREATE INDEX jobs_embedding_hnsw ON jobs USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE TABLE users (
  id           text PRIMARY KEY,             -- NextAuth session userId
  email        text UNIQUE,
  plan         text NOT NULL DEFAULT 'free', -- 'free'|'paid'
  plan_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_seen_job (
  user_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id    text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  seen_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX user_seen_job_seen_at_idx ON user_seen_job (user_id, seen_at DESC);

CREATE TABLE subscriptions (
  id              text PRIMARY KEY,
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          text NOT NULL,             -- 'active'|'expired'|'cancelled'|'pending'
  current_period_start timestamptz NOT NULL,
  current_period_end   timestamptz NOT NULL,
  sepay_order_id  text UNIQUE,               -- last order that activated/renewed
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_active_idx ON subscriptions (user_id, status);

CREATE TABLE sepay_webhook_events (
  event_id     text PRIMARY KEY,             -- SePay transaction id
  payload      jsonb NOT NULL,
  processed    boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id           text PRIMARY KEY,             -- crypto.randomUUID
  user_id      text NOT NULL REFERENCES users(id),
  amount_vnd   integer NOT NULL,
  status       text NOT NULL,                -- 'pending'|'completed'|'expired'
  payment_id   text NOT NULL,                -- transaction content "RR <orderId>"
  match_method text,                         -- 'content-parse'|'amount-window'|'amount-only'|null
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz,
  metadata     jsonb
);
CREATE INDEX orders_pending_amount_idx ON orders (status, amount_vnd, created_at)
  WHERE status = 'pending';
```

## Hot-path query (recommend route)

```sql
-- Filter: vertical match, active, NOT seen by user. Order by cosine distance.
SELECT id, score
FROM (
  SELECT j.id, 1 - (j.embedding <=> $1::vector) AS score
  FROM jobs j
  WHERE j.active = true
    AND j.vertical = $2
    AND NOT EXISTS (
      SELECT 1 FROM user_seen_job s
      WHERE s.user_id = $3 AND s.job_id = j.id
    )
  ORDER BY j.embedding <=> $1::vector  -- HNSW index used
  LIMIT $4
) t;
```

- HNSW respects ORDER BY operator; LIMIT pushed to index scan.
- `vertical` predicate uses `jobs_active_vertical_idx` for pool slice; HNSW kicks in for the ranking.
- For anon users: omit the NOT EXISTS clause; sessionStorage handles dedup client-side.
- Set `hnsw.ef_search = 40` per-session for recall/latency tuning (default 40; raise to 80 if recall drops).

## Connection pooling notes

- Vercel Function instance = one process; each invocation gets one Postgres connection from pgbouncer pool. No need for `pg-pool` config.
- `@neondatabase/serverless` HTTP path opens a fresh keep-alive per query — no warm-pool needed.
- Migration tool (Drizzle Kit) uses unpooled URL (`DATABASE_URL_UNPOOLED`) — required because pgbouncer transaction-mode does not support `LISTEN`, prepared statements, or DDL across pooled connections.

## Cost estimate (Vietnam scale, 1-2K jobs)

- Neon free tier: 0.5 GB storage, 190 compute hours/mo, auto-scale-to-zero.
- 2K jobs × (768 × 4 B embedding + ~2KB text) ≈ 8 MB row data + ~3 MB HNSW index = trivial.
- Read load: recommend p95 ≤25s currently → DB queries are ~50-150ms slice; well under 190 CH/mo at projected 10K req/mo.
- **Recommend free tier for pilot.** Upgrade to Launch ($19/mo) when >190 CH/mo OR if needing >0.5 GB.

## Migration tooling — Drizzle vs Prisma decision

Pick Drizzle Kit. Reasons (project-specific):
1. **No existing ORM in codebase.** Current repo uses raw `@vercel/kv` calls. Introducing Prisma's runtime client + binary generator is a step backward in bundle size (1.6 MB) for a project that prides itself on cold-start discipline.
2. **Drizzle is SQL-first.** Codebase already speaks SQL-style thinking (set ops, indexed lookups in vertical-index.ts). Drizzle's `db.select().from(jobs).where(...)` is one mental step from raw SQL.
3. **Cold-start budget.** Recommend route already burns 20-30s. A 500ms Prisma cold start vs <100ms Drizzle on a fresh Vercel function = measurable user-perceived gain.
4. **Migration ergonomics.** `drizzle-kit push` for dev, `drizzle-kit migrate` for prod, snapshots in `drizzle/` folder version-controlled. Comparable to Prisma Migrate but lighter.

Counter: Prisma's schema-DSL is more readable than Drizzle's TS schema. We accept the tradeoff — schema is small (6 tables).

## Risks

| # | Risk | Mit |
|---|---|---|
| 1 | HNSW recall drift after large insert burst (>500 new rows) | Set `hnsw.ef_construction=64` (good build quality). Monitor recall via 50-CV audit. Rebuild with `REINDEX INDEX CONCURRENTLY` if recall <0.9. |
| 2 | Region mismatch (Vercel `iad1` default, Neon Singapore) increases p50 by 200ms+ | Pin Vercel function region to `sin1` for `/api/jobs/*` routes via `export const preferredRegion = 'sin1'`. |
| 3 | Neon scale-to-zero cold start (~1s after 5min idle) | Mitigated by recommend traffic naturally keeping branch warm in business hours. For cron jobs (refresh), accept the 1s hit. |
| 4 | pgbouncer tx-mode breaks `pg_notify` if we add real-time later | Out of scope for this plan. Defer. |

## Sources

- [Neon for Vercel — Vercel Marketplace](https://vercel.com/marketplace/neon)
- [Neon serverless driver — Neon Docs](https://neon.com/docs/serverless/serverless-driver)
- [Migrate from Vercel Postgres SDK to Neon serverless driver](https://neon.com/guides/vercel-sdk-migration)
- [pgvector index selection: IVFFlat vs HNSW — Apr 2026](https://medium.com/@philmcc/pgvector-index-selection-ivfflat-vs-hnsw-for-postgresql-vector-search-6eff26aaa90c)
- [pgvector DBA guide part 2: Indexes — Mar 2026](https://www.dbi-services.com/blog/pgvector-a-guide-for-dba-part-2-indexes-update-march-2026/)
- [Drizzle vs Prisma ORM in 2026](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma)
- [Drizzle vs Prisma: 10× Faster Queries? 2026 Benchmarks](https://tech-insider.org/drizzle-vs-prisma-2026/)
