# Planner Report — Multi-Vertical Ingest Taxonomy

**Date:** 2026-06-03
**Plan:** `plans/260603-1655-ingest-taxonomy/`
**Status:** DONE

## Summary

Synthesized master plan + 5 sibling phase files for the multi-vertical job ingest taxonomy refactor. Plan locks the `filter-before-scrape` architecture per memory `feedback-filter-before-scrape`, consumes the 6 sibling taxonomy md docs (tech/marketing/finance/sales/ops/other), and turns them into a single typed module (`src/lib/jobs/taxonomy.ts`) that both scrape scripts and the post-ingest classifier consume — DRY single source of truth. Sequencing: Phase 1 (codification) → 2 (vl24h rewrite) → 3 (multi-board stretch) → 4 (re-ingest with backup-first) → 5 (cron integration with the related hybrid-refresh-topup plan). Existing `Vertical` enum stays flat; `subVertical?: string` field added to `Job` to carry sub-domain granularity without forcing KV migration on 150 live jobs.

## Files Created

- `plans/260603-1655-ingest-taxonomy/plan.md` (overwrote stale tech-only draft — 224 lines)
- `plans/260603-1655-ingest-taxonomy/phase-01-taxonomy-codification.md`
- `plans/260603-1655-ingest-taxonomy/phase-02-vl24h-prefilter-rewrite.md`
- `plans/260603-1655-ingest-taxonomy/phase-03-multi-board-probe.md`
- `plans/260603-1655-ingest-taxonomy/phase-04-reingest-and-rebuild.md`
- `plans/260603-1655-ingest-taxonomy/phase-05-cron-refresh-integration.md`
- `plans/reports/planner-260603-ingest-taxonomy.md` (this report)

## Key Decisions

1. **Flat `Vertical` enum retained + `subVertical?: string` added.** Alternative was to expand enum (`tech-software`, `tech-data`, …) but that breaks 150 prod KV records, breaks `MIN_VERTICAL_POOL=3` pool logic in `/api/jobs/recommend`, and demands embedding rework. Free-text `subVertical` field (e.g. `tech.software`, `sales.field-b2b`) is additive, auditable, and zero-migration on existing data.
2. **Single `taxonomy.ts` module, both consumers**: scrape-vl24h.ts AND classify.ts import from it. Drops the historical duplication where `vl24h-parser.SLUG_VERTICAL` and `classify.classifyVertical` each maintained their own ontology. DRY.
3. **Listing-card title sourced from URL slug, not extra HTML fetch.** vl24h encodes title in URL path between category-slug and `-c{id}p{id}id{id}.html`. Eliminates the need for separate listing-page parsing — title-slug + folded ASCII form is sufficient for positive/negative regex. Detail-fetch is the only HTTP cost for surviving URLs.
4. **Phase 3 (topcv + vnw) marked STRETCH.** vl24h alone covers all 6 verticals. If anti-bot blocks topcv (probe in step 1), phase closes as BLOCKED — does not block phases 4-5. Absorbs `260602-1652-topcv-scraper-ingest` plan's scope.
5. **Re-ingest is backup-first.** Phase 4 mandates `data/backup-pre-reingest-260603.json` dump before wipe. Rollback = `ingest-file.ts backup-file.json` + `build-vertical-index.ts`. Single command, well-rehearsed pattern.
6. **Per-vertical floor monitoring in Phase 5.** Floors: tech=30, marketing=20, finance=20, sales=25, ops=25, other=30. `MIN_VERTICAL_POOL=3` already on the recommend route means user-facing recommendation never breaks even when cron lags.
7. **Feature flag for Phase 5** (`CRON_TAXONOMY_TOPUP_ENABLED`). Cron rollback is a flag flip, not a code revert.

## Test Matrix (Carried into Phase Acceptance Criteria)

- Phase 1: 30+ positive + 30+ negative title fixtures pass; slug coverage assertion against md tables
- Phase 2: dry-run with rejection-reason counters; manual 20-tech-URL spot-check
- Phase 3: per-source ≥ 30 surviving URLs OR documented BLOCKED
- Phase 4: 20-job manual sample per vertical; ≥ 90% precision; ≥ 50 tech jobs
- Phase 5: synthetic depletion test (tech=2 → cron → tech ≥ 30); Pushover alert fires on persistent low

## Open Questions for User

1. **subVertical persistence cost.** Persist on Job record (~30 bytes/job → ~5 KB across 150 jobs, negligible) OR keep as derived field computed at recommend time? Plan default: persist. Open to flipping to derived if you want strictly minimum KV writes.
2. **Phase 3 scope.** Attempt topcv + vnw now (4-6h) or defer to a follow-up plan? Plan default: include as stretch — but if Phase 4 hits success metrics on vl24h alone (tech ≥ 50), skip and close.
3. **Backup target for Phase 4 wipe.** Local JSON file (cheap, off hot path, what plan defaults to) OR a `jobs:backup:260603` KV key with 7-day TTL (audit-friendly, costs nothing at our volume, slightly slower restore via KV scan)? Plan default: local JSON.

**Status:** DONE
**Summary:** Master plan + 5 phase files written; overwrote stale tech-only draft. Decisions locked on flat enum + subVertical field, single taxonomy module, backup-first re-ingest, stretch Phase 3. 3 open questions for user above.
**Concerns/Blockers:** none — taxonomy docs are complete and structurally consistent (positive/negative + slug tables in each), code paths verified against current implementation. The only true unknown is topcv/vnw anti-bot behavior, which Phase 3 step 1 probes before committing implementation time.
