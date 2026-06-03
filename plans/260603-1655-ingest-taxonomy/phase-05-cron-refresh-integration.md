# Phase 5 — Cron Refresh Integration

**Effort:** 3-4h
**Blocked by:** phase 4
**Cross-plan:** integrates with `plans/260602-1739-hybrid-refresh-topup/plan.md` (R5-R7 tasks)

## Goal

Wire the new `taxonomy.ts` filter into the daily refresh cron's top-up branch. When any vertical's active pool drops below a per-vertical floor, the cron scrapes only that vertical's URLs (slug + title pre-filtered) until back at the floor. Per-vertical pool monitoring + alerting.

## Files to Modify

- `src/app/api/jobs/refresh/route.ts` (owned by `260602-1739-hybrid-refresh-topup` plan — coordinate)
- `src/lib/jobs/refresh-batch.ts` — add top-up branch consuming taxonomy filter
- `src/lib/quota/alerts.ts` (or whatever the existing alert adapter is — Pushover / WhatsApp adapters are already wired per recent commits) — add `notifyVerticalPoolLow(vertical, count, floor)` helper

## Files to Create

- `scripts/audit-slug-drift.ts` — weekly task: pull fresh vl24h sitemap, diff slugs vs `taxonomy.ts` whitelist, emit warning if ≥ 5 unmapped slugs each with ≥ 20 listings

## Per-Vertical Floor

| Vertical | Floor | Rationale |
|----------|-------|-----------|
| tech | 30 | Headline use-case; tightest filter, highest risk of under-supply |
| marketing | 20 | Broad pool, less filter pressure |
| finance | 20 | Mid-volume on vl24h |
| sales | 25 | Largest natural pool, can afford higher floor |
| ops | 25 | Largest pool after sales |
| other | 30 | Catch-all, must stay broad |

Floor + `MIN_VERTICAL_POOL=3` in recommend route means: even when a vertical drops to 3, recommend still works (falls back to full-pool); cron has 9× headroom before that point.

## Implementation Steps

1. **Top-up logic in refresh-batch.ts**:
   - After the existing expire step, call `getVerticalIndex()` → count per vertical.
   - For each vertical with `count < FLOOR[v]`:
     - Call into a new `scrape-vl24h.ts` library export `scrapeVerticalTopUp(vertical, needed: number)` which runs the filtered scrape pipeline targeting just that vertical's slugs/sub-domains, limit=needed.
     - Ingest results immediately (skip the JSON-file intermediate step — cron writes direct to KV via existing ingest path).
     - After each top-up, recount + log.
   - Total cron budget cap: max 60 detail fetches per run to keep within free-tier embed quota + the 5-min vercel cron limit.

2. **Refactor scrape-vl24h.ts to expose a library entry point**:
   - Extract main loop body into `export async function scrapeVerticalTopUp({ vertical, target, maxAttempts, maxAgeDays }): Promise<VlJobInput[]>`.
   - Existing CLI `main()` becomes a thin wrapper over this.
   - Allows cron to call into the same code path without spawning a child process.

3. **Alerting**:
   - When `notifyVerticalPoolLow` triggers, message via existing Pushover adapter (see recent commit `103813f`): `"[ingest] Pool low: tech=${count}/${floor} after top-up. Investigate filter or source."`
   - Threshold for alert: count < floor AFTER top-up attempted (i.e. the top-up failed to fill).

4. **Slug-drift audit**:
   - `scripts/audit-slug-drift.ts` runs daily via the same cron (cheap, sitemap-only — no detail fetches).
   - Logic: parse vl24h sitemap → group URLs by slug → list slugs with ≥ 20 URLs that are NOT in `taxonomy.ts`. Emit each as a row.
   - Output: write to a KV key `jobs:slug-drift-audit` with TTL 8 days for the diagnostic endpoint to surface.
   - Add to /api/jobs/stats response.

5. **Feature flag**:
   - Cron behavior gated by env `CRON_TAXONOMY_TOPUP_ENABLED=1`. Default off; flip on after first manual test.
   - Rollback: flip flag to off, cron reverts to existing refresh-only behavior (still safe — no taxonomy dependency at recommend route level).

6. **Synthetic test**:
   - Local test: artificially expire jobs in tech until count = 2 (`scripts/ingest-expire.ts --vertical tech --keep 2`).
   - Trigger cron locally (`pnpm tsx -e "import('./src/lib/jobs/refresh-batch').then(m => m.runRefresh())"`).
   - Assert: tech count returns to ≥ FLOOR.tech (30) afterward.

## Acceptance Criteria

- [ ] `scrapeVerticalTopUp` callable from refresh-batch.ts without spawning subprocess
- [ ] Feature flag `CRON_TAXONOMY_TOPUP_ENABLED` gates behavior
- [ ] Synthetic test: tech drops to 2 → cron run → tech ≥ 30
- [ ] Pushover alert fires when post-top-up count still < floor
- [ ] audit-slug-drift.ts runs and outputs drift rows to KV
- [ ] /api/jobs/stats surfaces drift rows + current per-vertical counts + floors
- [ ] No regression in existing refresh-batch tests
- [ ] `pnpm tsc --noEmit` clean

## Risks

- **Vercel 5-min cron timeout.** Top-up could exceed if multiple verticals are deeply depleted. Mitigation: hard cap 60 detail fetches per run; remaining gap caught next day. The MIN_VERTICAL_POOL=3 fallback means user-facing recommend never breaks.
- **Embed quota spike on a depleted-multi-vertical day.** Worst case: 6 verticals × 30 jobs = 180 embeds, well within 1500 RPD. Safe.
- **Coordination conflict with `260602-1739-hybrid-refresh-topup` plan owning the cron route.** Mitigation: that plan's R5-R7 tasks delegate refresh-batch.ts work — this phase fills that delegation. Coordinate via task board if both plans run in parallel.
- **Alert fatigue.** Pushover spamming if pool oscillates around floor. Mitigation: rate-limit alerts to 1 per vertical per day (KV key `alerts:vertical-low:{v}` with 24h TTL).

## Rollback

`CRON_TAXONOMY_TOPUP_ENABLED=0`. Cron reverts to existing expire-only refresh. No data lost. taxonomy.ts still consumed by ingest CLI + scrape scripts; no regression there.

## Next Steps After Phase 5

- Close this plan as `status: completed`.
- Mark `260602-1652-topcv-scraper-ingest` as `status: superseded` (absorbed into Phase 3).
- Update memory: `project-cvmatching-v01-state` reflects new ingest architecture.
- Consider a follow-up plan: add itviec.com as a pure-tech source (Phase 1 already references it in tech taxonomy §B.3) — zero negative filter needed, highest-purity tech pool.
