# Hybrid Refresh — Verify + Auto Top-up

**Created:** 2026-06-02 17:39
**Status:** 📋 Planned — deferred from 260602-1652 session (scope too large to bundle)
**Predecessor:** 150 real vl24h jobs ingested + recommend endpoint live (post-fix)

---

## Context

Current `/api/jobs/refresh` cron HEAD-checks `sourceUrl`s, expires zombies, and fires a `pool-low` webhook when `remainingActive < 50`. As vl24h listings rotate (1-2 week TTL each), this will steadily drain the pool over weeks. Manual operator response (re-run scraper + ingest) isn't reliable.

**Decision recorded 2026-06-02:** ship hybrid pattern — refresh still verifies as primary, but when active drops below threshold, refresh *also* triggers a scrape top-up scoped to the shortfall verticals.

## Why deferred

- The vl24h scraper currently lives in `scripts/scrape-vl24h.ts` as a CLI orchestrator. To reuse it from the cron we need to extract the sitemap/bucket/parse/embed/save flow into a library, leaving the script as a thin CLI wrapper.
- Cron `maxDuration` is 300s and the verify pass already uses 200-250s on a large pool. Top-up needs strict per-vertical and per-job time budgets, plus parallel detail fetches, plus graceful early-stop. Not a 30-minute change.
- Belongs in its own commit/PR for review.

## Tasks

- [ ] **R1. Extract scraper to lib.** New `src/lib/scrape/vl24h-scraper.ts` exposes `scrapeVl24h(opts) → AsyncIterable<VlJobInput> | Promise<VlJobInput[]>`. Opts: `{ shortfallByVertical: Partial<Record<Vertical, number>>, deadlineMs, skipUrls: Set<string>, detailDelayMs }`. Reuses `vl24h-parser.ts`.
- [ ] **R2. Slim `scripts/scrape-vl24h.ts`.** Becomes a CLI wrapper around `scrapeVl24h`: parses args, calls lib, writes output JSON. ~50 lines.
- [ ] **R3. Add top-up stage to `/api/jobs/refresh`.**
  - After verify pass, compute `byVertical` from remaining active jobs.
  - Per-vertical shortfall = `targetMin - currentCount` where `targetMin = 25` (matches seed shape).
  - If total shortfall > 0 AND `Date.now() < deadlineMs - SCRAPE_BUFFER_MS (60s)`, call `scrapeVl24h` with the gap.
  - For each returned JobInput: dedup by id, embed via `embedText`, `saveJob`, accumulate ids.
  - At end: call `rebuild-embeddings` equivalent (extract `packEmbeddings + saveBlobChunk + saveBlobMeta + setActiveBlobVersion` into a reusable `repackEmbeddingIndex()` lib function).
- [ ] **R4. Budget guards.** Top-up stage must stop fetching/embedding when `Date.now() >= deadlineMs - 60s`. Partial saves OK — next cron tick continues.
- [ ] **R5. Tests.** Vitest with mocked KV + mocked fetch. Cases: (a) no shortfall → top-up skipped; (b) shortfall + budget → N jobs added; (c) shortfall + tight budget → partial top-up; (d) all verticals at target → noop.
- [ ] **R6. Metrics.** Add `topup_added` and `topup_skipped_budget` to `metrics:refresh:{ymd}` hash so we can observe over time.
- [ ] **R7. Smoke prod after deploy.** Manually delete ~50 jobs from KV, invoke cron, confirm top-up runs.

## Risks

| Risk | Mitigation |
|---|---|
| Cron exceeds 300s on top-up | Hard deadline check before every fetch + embed |
| vl24h API rate-limits during top-up | Existing 1.5s/req delay; max 50 fetches per top-up |
| Embedding quota burn | Cap top-up at 50 jobs/run (free tier 1500/day handles 30 runs) |
| Index repack during traffic | `setActiveBlobVersion` is atomic; old version remains readable until flipped |

## Files to touch

- NEW `src/lib/scrape/vl24h-scraper.ts` (~120 LOC)
- NEW `src/lib/jobs/repack-embeddings.ts` (~40 LOC)
- MODIFY `scripts/scrape-vl24h.ts` (-100, +40)
- MODIFY `src/app/api/jobs/refresh/route.ts` (+50)
- NEW `tests/refresh-topup.test.ts` (~120 LOC)

## Open questions

- Should top-up use the same `GEMINI_API_KEY` env as ingest CLI, or the BYOK-resolved key from the cron context? (Probably env — cron has no user.)
- Should `targetMin` be vertical-specific (e.g. tech=30, others=20)? Probably uniform 25 to match initial seed.
- Should top-up also `expireJob` zombies on the spot, or leave that to next cron tick? Existing flow already does in the verify pass; top-up just adds, doesn't remove.
