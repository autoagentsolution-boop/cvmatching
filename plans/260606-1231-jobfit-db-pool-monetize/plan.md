---
title: "Job Fit DB migration, pool scale-up, tier-gated monetization"
description: "Migrate jobs+embeddings to Neon+pgvector, scale pool to 1-2K, gate features by free/paid tier with SePay VietQR billing"
status: in-progress
priority: P1
effort: 38-54h
branch: main
tags: [neon, pgvector, sepay, monetization, ingest, jobfit]
created: 2026-06-06
phasesShipped: [1, 2, 3, 4, 6]
phaseOrder: [1, 2, 3, 4, 6, 7, 5, 8]
---

# Job Fit DB Migration + Pool Scale + Monetization

## Status

Pending. Locks the architecture for the next major initiative. Builds on:
- v0.4 CV-solo Analyze (shipped 2026-06-04)
- ITviec ingest via curl (shipped 2026-06-05)
- Taxonomy plan `260603-1655-ingest-taxonomy` Phase 1 module (still valid; Phases 4-5 there are obsoleted by this plan).

## Problem

Job Fit currently serves ~171 active jobs from Upstash KV. Pool too narrow → Job Fit returns the same 2 jobs every refresh. KV cosine-sim-over-blob doesn't scale past ~5K rows. No monetization layer → can't differentiate free vs power users.

## Locked decisions

1. **DB:** Neon Postgres + pgvector (Vercel Marketplace). Jobs/embeddings/users/seen/subs/orders → Postgres. Quota counters + kill-switch + embed-cache STAY on KV.
2. **Payment:** SePay VietQR (bank transfer). Subscription = renewal-by-transfer (no card auto-renewal).
3. **Refresh dedup:** Postgres `user_seen_job` table for signed-in users; sessionStorage for anon.
4. **Pool target:** 1-2K active jobs across 6 verticals (ITviec + vl24h existing; TopCV + VNW added).

## Tier-gating rule

| User class | Jobs surfaced | Tiers allowed |
|---|---|---|
| Anon | 1 (teaser) — see Q1 | B only |
| Free signed-in | 1-2 | B only |
| Paid signed-in | 5-10 | All — S, A, B, C, D, E per existing QUOTA |

Existing `enforceQuota` in `src/lib/jobs/fit-tier.ts` is the upper cap for paid; free is a strict subset filter applied AFTER quota.

## Phase map

| # | Phase | File | Effort | Status | Commit |
|---|---|---|---|---|---|
| 1 | Neon provision + schema | [phase-01-neon-provisioning-and-schema.md](./phase-01-neon-provisioning-and-schema.md) | 4-6h | ✅ SHIPPED 2026-06-06 | `46020f9` |
| 2 | Data-access layer (jobs repo over Postgres) | [phase-02-data-access-layer.md](./phase-02-data-access-layer.md) | 5-7h | ✅ SHIPPED 2026-06-06 | `fc0876d` |
| 3 | KV → Postgres migration script | [phase-03-kv-to-postgres-migration.md](./phase-03-kv-to-postgres-migration.md) | 3-4h | ✅ SHIPPED 2026-06-06 + RUN (171/171 jobs) | `6a66429` |
| 4 | Recommend endpoint rewrite (pgvector + tier gate) | [phase-04-recommend-endpoint-rewrite.md](./phase-04-recommend-endpoint-rewrite.md) | 6-8h | ✅ SHIPPED 2026-06-06 (JOBFIT_USE_POSTGRES=1 on Vercel) | `800c108` |
| 6 | Monetization (SePay subscription + /upgrade) | [phase-06-monetization-sepay-subscription.md](./phase-06-monetization-sepay-subscription.md) | 6-8h | ✅ SHIPPED 2026-06-06 (code only — SePay dashboard wiring + 1k VND smoke test still operator-pending) | _pending commit_ |
| 7 | Refresh dedup + "no more matches" UX | [phase-07-refresh-dedup-and-no-more-matches-ux.md](./phase-07-refresh-dedup-and-no-more-matches-ux.md) | 3-4h | pending | — |
| 5 | Scraper fleet — TopCV + VNW | [phase-05-scraper-fleet-topcv-vnw.md](./phase-05-scraper-fleet-topcv-vnw.md) | 8-12h | pending | — |
| 8 | Cutover + KV decommission | [phase-08-cutover-and-decommission.md](./phase-08-cutover-and-decommission.md) | 3-5h | pending | — |

**Original sequencing:** 1 → 2 → {3, 5} → 4 → {6, 7} → 8.
**Revised sequencing (user-confirmed 2026-06-06 16:45):** 1 → 2 → 3 → 4 → **6 → 7 → 5 → 8**.
Rationale: free tier sees only 2 tier-B jobs from existing pool; Phase 6 (monetization) is the user-impact unlock. Pool scale-up (Phase 5) deferred since 171 jobs serve initial paid traffic. Phase 7 is small UX cleanup before fan-out work.

## Migration result (Phase 3 live run, 2026-06-06)

- KV active 171 → PG upserted 171 (0 skipped, 0 field diffs)
- Per-vertical in PG: finance 28 · marketing 25 · ops 25 · other 41 · sales 25 · tech 27
- pgvector 0.8.0, HNSW (m=16, ef_construction=64) confirmed via db-verify-indexes
- Parity verify "fails" on embeddings — known false positive: score.ts sources from `embeddings:active` blob, NOT per-job hash. PG matches blob.

## Research

- [research/neon-pgvector-vercel-2026.md](./research/neon-pgvector-vercel-2026.md) — driver, pooler, HNSW, Drizzle pick
- [research/sepay-subscription-flow.md](./research/sepay-subscription-flow.md) — renewal-by-transfer model, webhook flow
- [research/topcv-vnw-scrape-recon.md](./research/topcv-vnw-scrape-recon.md) — Cloudflare-gated, reuse curl, JSON-LD pattern

## Hard constraints

- YAGNI/KISS/DRY. Target = 1-2K jobs, not 100K.
- Quota counters + kill-switch + embed-cache stay on KV.
- Filter-before-scrape (URL slug + listing title regex) applies to every new source.
- Freshness ≤3d for ingest.
- No silent heuristic fallback on errors.
- TopCV + VNW use `fetchViaCurl` (Cloudflare).
- Per-source CV state preserved.
- Recommend route region pinned to `sin1`.
- Type discipline: Postgres `jobs` row satisfies `Job` from `src/lib/jobs/types.ts`.
- ONE migration tool: Drizzle Kit.

## Success metrics

- Active pool ≥1000 jobs across 6 verticals (≥150/vertical for tech, ≥100 others).
- Recommend p95 ≤25s (no regression vs KV baseline).
- pgvector recall ≥90% on 50-CV audit set.
- Free user sees ≤2 jobs, all tier B+ from recommend response.
- Paid user sees 5-10 jobs incl. tier S/A.
- SePay webhook idempotent (replay test passes; same orderId never double-completes).
- Refresh dedup: signed-in user never sees same job twice within 90 days; anon never sees same job twice in same session.

## Open questions (deferred — defaults applied)

1. **Anon UX**: 0 jobs (sign-in required) vs 1 teaser tier-B. Default: 1 teaser.
2. **SePay cancel flow**: manual non-renewal vs explicit cancel endpoint. Default: implicit.
3. **pgvector index**: HNSW chosen; revisit if pool >10M.
4. **KV `jobs:active` retention**: keep as 90-day audit snapshot vs full decommission. Default: snapshot then drop.
5. **Migration window**: zero-downtime dual-read vs brief maintenance flag. Default: dual-read.
6. **Free tier B+ only or B+C+D**: user said "S+A only for paid". Default: free = B only (strictest interp).
7. **Trial period**: none / 7d / first-month. Default: none.
8. **Paid plan name**: "Pro" / "Plus" / "Paid". Default: "Pro".
9. **Persistent dedup TTL**: forever / 6mo / 90d. Default: 90d sliding window.
