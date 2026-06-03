---
name: ingest-taxonomy
title: Multi-Vertical Ingest Taxonomy + Filter-Before-Scrape
status: pending
created: 2026-06-03
owner: vinh2000ld11@gmail.com
blockedBy: []
blocks: []
related: [260602-1739-hybrid-refresh-topup, 260602-1652-topcv-scraper-ingest]
effort: 16-24h
---

# Multi-Vertical Ingest Taxonomy + Filter-Before-Scrape

## Status

Pending — 6 taxonomy docs landed, awaiting implementation. Wave A pilot exposed the broken architecture; this plan locks the rebuild.

## Problem

Wave A landed 150 vl24h jobs to prod KV using a slug→vertical map that was too coarse. Tech bucket polluted with mechanical / electrical / auto / telecom roles whose VN titles share "kỹ sư" with software engineering. Tighten-and-reclassify cycle is wasteful: 25→9 tech jobs, still mostly IT-support noise, only 1 genuine software role.

Architectural rule from memory `feedback-filter-before-scrape`: **filter at URL slug + listing title BEFORE downloading detail HTML; never scrape broad and reclassify after.** Taxonomy must be research-driven, bilingual (VN + EN), cover all 6 verticals — done in 6 sibling taxonomy docs already in this dir.

Same pollution risk exists for every other vertical: sales picks up insurance agents, finance picks up insurance sales, ops catches manufacturing-floor roles that belong in `other`.

## Scope

**IN**
- All 6 verticals: `tech`, `marketing`, `finance`, `sales`, `ops`, `other`
- URL-slug + listing-card title filter applied at scrape time (pre-detail-fetch)
- Bilingual (VN + EN) positive + negative title patterns per sub-domain
- vl24h.com.vn primary; topcv.vn + vietnamworks.com as Phase 3 stretch
- Sub-domain metadata persisted on Job records (without breaking flat Vertical enum)

**OUT**
- New scrape sources beyond the 3 boards above (itviec / careerlink deferred to a future plan)
- Embedding re-generation strategy (existing gemini-embedding-001 pipeline unchanged)
- Vertical enum expansion (kept flat — `subVertical: string` carries the granular signal)

## Stack

Existing scraper infra unchanged: `src/lib/scrape/fetch-html.ts`, `extract-readability.ts`, `detect-antibot.ts`, `vl24h-parser.ts`. Upstash KV via `kv-client`. Ingest CLI (`scripts/ingest-jobs.ts`, `ingest-file.ts`). Vertical sidecar index (`src/lib/jobs/vertical-index.ts`).

## Architectural Decisions

1. **Flat `Vertical` enum retained.** Adding sub-vertical enum members (e.g. `tech-software`, `tech-data`) would force KV migration on 150 live jobs + break the `MIN_VERTICAL_POOL=3` pool logic in the recommend route. Cheaper: add `subVertical?: string` to `Job` (free-text, scoped to each vertical's taxonomy ids like `software.backend`, `data.engineer`, `ml.engineer`).
2. **Filter module is the single source of truth.** New file `src/lib/jobs/taxonomy.ts` exports per-vertical sub-domain definitions (positive regex, negative regex, slug list per source) consumed by both scrape-vl24h.ts AND post-ingest `classify.ts`. DRY: one taxonomy, two consumers.
3. **classify.ts becomes the last line of defence**, not the first. Pre-filter happens at scrape time; classify.ts only runs on jobs already passing the gate, used to assign `vertical` + `subVertical` when slug context is missing.
4. **Bucket loop driven by per-vertical config.** scrape-vl24h.ts reads `taxonomy.ts`, no hardcoded slug→vertical map in the parser anymore.

## Data Flow

```
sitemap-index.xml
   ↓ parse 4 child sitemaps
job-detail URL list  ──┐
                       │  (1) URL slug whitelist check  →  skip if not in source.slugs
                       │      taxonomy.ts: SOURCES.vl24h[vertical].slugs
                       ↓
listing card title  ──┐
                      │  (2) positive regex match  →  drop to next sub-domain
                      │  (3) negative regex match  →  reject  
                      │      taxonomy.ts: VERTICALS[v].subDomains[sd].{positive, negative}
                      ↓
detail HTML fetch (only for surviving URLs)
                      ↓
JobPosting ld+json parse  →  title + company validated again
                      ↓
ldToJobInput → JobInput with vertical + subVertical attached
                      ↓
ingest-file.ts → embed → save to KV → vertical-index rebuilt
```

Failure modes mitigated at each step: slug rejection logged, title rejection logged, ld+json parse fail surfaces (no silent drop — `feedback-error-surfacing-no-silent-fallback`).

## Phases

| # | File | Effort | Focus |
|---|------|--------|-------|
| 1 | [phase-01-taxonomy-codification.md](./phase-01-taxonomy-codification.md) | 2-3h | 6 taxonomy md → typed TS module `src/lib/jobs/taxonomy.ts` with positive/negative regex per sub-domain + slug map per source |
| 2 | [phase-02-vl24h-prefilter-rewrite.md](./phase-02-vl24h-prefilter-rewrite.md) | 3-4h | Rewrite scrape-vl24h.ts to apply slug + listing-title filter before detail fetch; carry subVertical through ldToJobInput |
| 3 | [phase-03-multi-board-integration.md](./phase-03-multi-board-integration.md) | 4-6h | Probe topcv.vn + vietnamworks.com listing structures; build parsers under same taxonomy contract; integrate as alt sources |
| 4 | [phase-04-reingest-and-rebuild.md](./phase-04-reingest-and-rebuild.md) | 2-3h | Wipe prod KV, re-ingest under new filter, target 100+ tech / 25+ per other vertical, rebuild vertical-index, verify via diagnostic endpoint |
| 5 | [phase-05-cron-refresh-integration.md](./phase-05-cron-refresh-integration.md) | 3-4h | Wire taxonomy module into `260602-1739-hybrid-refresh-topup` cron top-up; per-vertical pool floor monitoring + alerts |

**Sequencing:** strictly sequential. Phase 2 blocked by 1 (needs the module). Phase 3 blocked by 2 (vl24h proves the contract). Phase 4 blocked by 2 (vl24h alone covers most verticals; topcv is bonus). Phase 5 blocked by 4 (cron needs verified taxonomy in prod).

## Hard Constraints

- `feedback-filter-before-scrape` — filter at URL slug + listing-card title BEFORE detail HTML download
- `project-ingest-freshness-constraint` — every ingested job real + currently open + posted ≤ 3 days; existing `--max-age-days 3` flag enforced
- `feedback-error-surfacing-no-silent-fallback` — surface scrape / parse / KV failures with actionable messages; never drop a candidate silently except for legitimate filter rejections (which must be counted + logged)

## Top Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | Slug taxonomy drift on source sites (vl24h adds / removes / renames slugs) | Medium | Medium | Phase 4 includes a slug-coverage audit that diffs sitemap slugs vs taxonomy.ts whitelist; weekly cron emits an alert when an unmapped slug shows ≥ 20 listings |
| 2 | Bilingual regex false-negatives (VN + EN combinations explode → real jobs rejected) | High | High | Each sub-domain regex pair (positive + negative) gets a 10-title test fixture in Phase 1; Phase 4 acceptance requires 20-job manual sample per vertical with ≥ 90% precision AND ≥ 80% recall on a held-out title set |
| 3 | Filter tightening shrinks per-vertical pool below MIN_VERTICAL_POOL=3 | Medium | High | Phase 5 cron monitors pool size; falls back to relaxed regex (positive-only, no negative) for any vertical with < 10 active jobs; alerting via Pushover when floor breached |
| 4 | topcv anti-bot harder than vl24h → Phase 3 blocked | Medium | Low | Phase 3 is stretch; vl24h alone covers all 6 verticals. If topcv blocked, document findings + defer to follow-up plan, do not retry-loop |

## Test Matrix

| Layer | Tested in | Method |
|-------|-----------|--------|
| Per-sub-domain regex correctness | Phase 1 | Vitest unit suite with 10+ titles per sub-domain (positive + negative fixtures pulled from taxonomy docs §E test cases) |
| Slug whitelist coverage | Phase 1 | Test fixture asserts every slug in the 6 taxonomy md tables is present in taxonomy.ts |
| Pre-filter integration | Phase 2 | Dry-run scrape-vl24h with mocked sitemap; assert reject-count by reason matches expected bucket sizes |
| Multi-board parser parity | Phase 3 | Same JobInput shape across vl24h / topcv / vnw; cross-source dedupe key works |
| End-to-end ingest | Phase 4 | Diagnostic endpoint `/api/jobs/stats` returns per-vertical + per-subVertical counts; 20-job manual sample per vertical reviewed by user |
| Cron stability | Phase 5 | Synthetic test: simulate one vertical dropping to 2 jobs → assert top-up scrape triggers + fills back to floor |

## Rollback Plan

Each phase has an isolated rollback:

- **Phase 1**: delete `src/lib/jobs/taxonomy.ts` + revert `types.ts`; nothing depends on it yet.
- **Phase 2**: `git revert` the scrape-vl24h + vl24h-parser commit; old behaviour restored.
- **Phase 3**: alt-board parsers are isolated files; remove them, keep vl24h-only.
- **Phase 4**: prod KV wipe is the destructive step. Mitigation: dump current prod KV (`scripts/ingest-stats.ts --dump`) to `data/backup-pre-reingest-260603.json` BEFORE wipe. If new ingest produces < 50 total jobs OR tech bucket < 20, restore via `ingest-file.ts data/backup-pre-reingest-260603.json`.
- **Phase 5**: cron flag-gated behind `CRON_TAXONOMY_TOPUP_ENABLED`; flip to off to revert to existing cron behavior.

## File Ownership

No two phases edit the same file:

- Phase 1 owns: `src/lib/jobs/taxonomy.ts` (new), `src/lib/jobs/types.ts` (add subVertical field), unit tests
- Phase 2 owns: `scripts/scrape-vl24h.ts`, `src/lib/scrape/vl24h-parser.ts`, `src/lib/jobs/classify.ts` (consume taxonomy module)
- Phase 3 owns: `src/lib/scrape/topcv-parser.ts` (new), `src/lib/scrape/vnw-parser.ts` (new), `scripts/scrape-topcv.ts` (new), `scripts/scrape-vnw.ts` (new)
- Phase 4 owns: prod KV state (no code changes except a one-off `scripts/wipe-and-reingest.ts` script)
- Phase 5 owns: cron integration files from the related `260602-1739-hybrid-refresh-topup` plan

## Success Metrics

- Tech bucket ≥ 50 pure software / data / ML / AI jobs post-ingest (sub-domains: software.*, data.*, ml.*, devops.*, security.*)
- Per-vertical pool ≥ 25 active jobs across all 6 buckets
- Zero false-positives in 20-job manual sample per bucket
- Recommend p95 latency ≤ 25s (no regression from current baseline)
- Vertical classifier confidence ≥ 90% per 50-job audit set
- Unmapped slug count ≤ 2 per weekly sitemap scan

## Cross-Plan Coordination

- **`260602-1652-topcv-scraper-ingest`**: that plan's TopCV scraper work is **absorbed into Phase 3**. Mark that plan blocked-by-this one; deliverables here supersede.
- **`260602-1739-hybrid-refresh-topup`**: Phase 5 integrates with R5-R7 tasks of that plan (cron top-up logic). Coordinate file ownership: that plan owns the cron route; this plan owns the taxonomy module the cron imports.

## Open Questions (carry to user)

1. SubVertical field: persist on Job model (KV writes grow ~30 bytes/job) or keep as derived field in classify.ts only? Default plan: persist (simpler + auditable, marginal cost).
2. Phase 3 topcv: attempt it now or defer? Default plan: include as 4-6h stretch — but if Phase 1+2+4 already hit success metrics, skip and close.
3. Backup-before-wipe strategy: dump to local JSON file vs. dump to a `jobs:backup:260603` KV key with 7-day TTL? Default plan: local JSON (cheaper, off the hot path).
