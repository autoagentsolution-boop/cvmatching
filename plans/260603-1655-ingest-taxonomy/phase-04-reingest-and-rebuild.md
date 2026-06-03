# Phase 4 — Re-Ingest & Rebuild

**Effort:** 2-3h
**Blocked by:** phase 2 (3 optional)
**Blocks:** phase 5

## Goal

Wipe prod KV, re-ingest via the new filter-before-scrape pipeline, rebuild the vertical-index, and verify per-vertical purity via diagnostic endpoint + manual sample.

## Files to Modify / Create

- `scripts/wipe-and-reingest.ts` (new, one-off) — orchestrates backup-dump → wipe → scrape → ingest-file → vertical-index rebuild as a single command. Refuses to run without `--i-have-backed-up` flag.
- `src/app/api/jobs/stats/route.ts` (modify if exists, else create) — diagnostic endpoint returning `{ totalActive, perVertical: { tech: N, marketing: N, ... }, perSubVertical: { 'tech.software': N, 'tech.data': N, ... }, sampleTitles: { tech: [...20], ... } }`. Admin-gated.

## Implementation Steps

1. **Backup current prod KV** to local JSON (constraint: never destroy without snapshot):
   ```pwsh
   pnpm tsx scripts/ingest-stats.ts --dump > data/backup-pre-reingest-260603.json
   ```
   Verify file size > 100 KB and contains all 150 jobs. If `ingest-stats.ts` lacks `--dump`, add it (small addition: iterate `listActiveIds` → `getJobBatch` → write JSON).

2. **Dry-run scrape with new filter** (vl24h only first):
   ```pwsh
   pnpm tsx scripts/scrape-vl24h.ts --limit 50 --max-age-days 3 --max-attempts 200 --out data/scraped-260603-vl24h.json
   ```
   Inspect output. Per-vertical count expected: tech ≥ 30, others ≥ 25. If tech < 20, investigate filter regex before continuing.

3. **(Optional) Add topcv + vnw outputs** if Phase 3 ran:
   ```pwsh
   pnpm tsx scripts/scrape-topcv.ts --limit 30 --max-age-days 3 --out data/scraped-260603-topcv.json
   pnpm tsx scripts/scrape-vnw.ts --limit 30 --max-age-days 3 --out data/scraped-260603-vnw.json
   pnpm tsx scripts/dedupe-cross-source.ts data/scraped-260603-*.json > data/scraped-260603-merged.json
   ```

4. **Wipe prod KV**:
   ```pwsh
   # Confirm KV target is prod via ENV; refuse if KV_REST_API_URL not prod-tagged
   pnpm tsx scripts/wipe-and-reingest.ts --wipe-only --i-have-backed-up
   ```
   `wipe-only` deletes `jobs:*` keys and `jobs:by-vertical` index. Logs deleted key count.

5. **Re-ingest from merged JSON**:
   ```pwsh
   pnpm tsx scripts/ingest-file.ts data/scraped-260603-merged.json
   ```
   This runs the existing ingest path: classify → embed (gemini-embedding-001) → KV save. Watch for embed quota usage (free tier 1500 RPD).

6. **Rebuild vertical-index**:
   ```pwsh
   pnpm tsx scripts/build-vertical-index.ts
   ```
   Sanity-print: `tech=N marketing=N finance=N sales=N ops=N other=N`.

7. **Verify via diagnostic endpoint**:
   ```pwsh
   curl https://{prod}/api/jobs/stats?admin_key=$env:ADMIN_KEY | jq
   ```
   Check `perSubVertical` populated, `sampleTitles.tech` shows real software/data/ML titles only.

8. **Manual purity audit** (20-job sample per vertical):
   - Open the 20 titles per bucket. Reject if title obviously belongs elsewhere.
   - Acceptance: ≤ 2 false-positives per 20-job sample (≥ 90% precision).
   - If tech fails: revisit Phase 2 listing-card filter; do NOT proceed to Phase 5.

9. **Update memory** with new prod state via `project_cvmatching_v01_state.md` (post-reingest counts + date).

## Acceptance Criteria

- [ ] Backup JSON written, size ≥ 100 KB
- [ ] Total active jobs after re-ingest ≥ 150
- [ ] Per-vertical pool ≥ 25 across all 6 verticals
- [ ] Tech bucket ≥ 50 with software / data / ml / devops / security sub-verticals represented
- [ ] Diagnostic endpoint returns valid stats payload
- [ ] 20-job sample per vertical shows ≥ 90% precision (≤ 2 false-positives)
- [ ] Vertical-index rebuilt and recommend route still works against new pool (smoke: hit `/api/jobs/recommend` with a sample CV id, get non-empty matches)
- [ ] Memory `project-cvmatching-v01-state` updated

## Risks

- **Embed quota exhaustion mid-reingest.** 150 jobs × 1 embed each = well under 1500 RPD, low risk. Mitigation: ingest-file.ts already chunks; if quota hit, resume on next day from cached partial output.
- **Re-ingest yields < 50 tech jobs.** Mitigation: rollback via `pnpm tsx scripts/ingest-file.ts data/backup-pre-reingest-260603.json`. Diagnose regex; tighten or relax positive patterns; retry. Memory the post-mortem.
- **Diagnostic endpoint leaks data.** Mitigation: admin_key gate already exists pattern in codebase (see `cost-kill-switch.ts`); reuse same middleware.
- **Smoke matches go to zero (recommend returns empty for every CV).** Mitigation: vertical-index rebuild step verifies the 6 buckets are non-empty; if any < 3, `MIN_VERTICAL_POOL` fallback already merges into full-pool match (no user-facing failure).

## Rollback

```pwsh
pnpm tsx scripts/wipe-and-reingest.ts --wipe-only --i-have-backed-up
pnpm tsx scripts/ingest-file.ts data/backup-pre-reingest-260603.json
pnpm tsx scripts/build-vertical-index.ts
```

Returns prod to its pre-phase-4 state. Memory the rollback in `project-cvmatching-v01-state`.

## Next Phase

→ [phase-05-cron-refresh-integration.md](./phase-05-cron-refresh-integration.md)
