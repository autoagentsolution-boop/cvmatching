# Next Session Runbook — Ingest Taxonomy + Heavy Day

**Wrote:** 2026-06-03 19:30 ICT after Phase 2 ship.
**For:** First-thing-tomorrow start (2026-06-04). Heavy day expected.

## Where we are (end of 2026-06-03)

| Phase | Status |
|---|---|
| Phase 1 — taxonomy.ts codification | ✅ Shipped (`8e2a710`) |
| Phase 2 — vl24h pre-filter rewrite | ✅ Code shipped (`3bcb2ab`). **Live dry-run deferred to tomorrow.** |
| Phase 3 — multi-board topcv + vnw | 📋 Pending (stretch) |
| Phase 4 — wipe prod KV + re-ingest | 📋 Pending (DESTRUCTIVE — needs explicit go) |
| Phase 5 — cron taxonomy top-up | 📋 Pending (blocked by Phase 4) |

Sidebands also live:
- Dashboard hero overflow → fixed (`e2f7f4f`).
- `260603-1205-ui-polish` plan still pending, blocked by `260602-1739-hybrid-refresh-topup`.
- `260602-1739-hybrid-refresh-topup` (R1-R7) — also pending; conflicts with Phase 5 file ownership (cron route). Coordinate ownership when both fire.
- v0.3.1 pilot lockdown is live — re-enable runbook in `docs/deployment.md §17`. Memory `project_cvmatching_v01_state` is the canonical state record.

## First action (≤ 5 min)

```bash
cd cv-ex-refactor
pnpm tsx --env-file=.env.local scripts/scrape-vl24h.ts --dry-run --limit 50 --max-age-days 3
```

Expected runtime: ~5-10 min (sitemap fetch + detail-loop for ~25-50 detail
fetches × 1.5s delay; the new pre-filter prunes ≥80% of sitemap URLs
before any detail HTTP).

What to read in the output:

1. **PRE-FILTER block (top, no HTTP yet):**
   - `surviving:` should land roughly between 200-600 of the ~3000-5000
     candidate URLs (filter is intentionally tight).
   - Per-vertical `survived=` should be ≥50 for each of tech, marketing,
     finance, sales, ops, other. If any vertical falls below 25, taxonomy
     is over-tightened for that vertical — log it, don't kill the run.
   - `rejNeg` should be > 0 for tech (kỹ sư cơ khí, sales engineer) and
     finance (insurance agent). If `rejNeg=0` for these verticals, the
     negative regex isn't firing — recheck `TECH_NEGATIVE` / `FINANCE_NEGATIVE`.

2. **Per-vertical detail summary (bottom):**
   - `collected=N` should hit 50/vertical (since `--limit 50`).
   - `rejDetail` is the count where `ld.title` got reclassified to a
     negative-match by the detail-stage check. Should be ≤5/vertical
     (cases where URL slug is too truncated to catch the negative signal).

3. **20-URL spot check** for tech bucket:
   - Read the 20 logged `[scrape-vl24h]   tech [N/50] ✓ [tech.X] <title>`
     lines from the run output. Each should be a real software / data / ML /
     devops / security role. ZERO kỹ sư cơ khí. ZERO insurance agents.
     ZERO IT-support generic. If even 1 false-positive lands, dig the
     specific title's taxonomy hit before moving on.

If all three checks pass → Phase 2 is verified, ready to merge Phase 3
plans.

## Decision tree from there

```
dry-run output OK?
├─ YES → choose next track:
│   ├─ Track A: Phase 3 (multi-board topcv + vnw) — 4-6h
│   │   └─ Non-destructive. New parsers + scripts. Same taxonomy contract.
│   ├─ Track B: Phase 4 (wipe + re-ingest) — 2-3h + monitoring
│   │   └─ DESTRUCTIVE. Pre-Phase-4 prep:
│   │       1. Backup current prod KV: `pnpm tsx --env-file=.env.local scripts/ingest-stats.ts --dump > data/backup-pre-reingest-260604.json`
│   │       2. Verify backup file ≥150 jobs.
│   │       3. Get user explicit "go" before wipe.
│   │       4. Run new ingest pipeline.
│   │       5. Diagnostic: `/api/jobs/stats` per-vertical + per-subVertical counts.
│   │       6. If tech bucket < 20 OR any vertical < 50 → restore backup.
│   └─ Track C: Sideband — UI polish or hybrid-refresh-topup
│       └─ If pilot re-enable runbook is the actual priority, switch tracks.
│
└─ NO (any vertical underfilled or false-positives surface) →
    Track 0: Taxonomy tuning
    ├─ Underfill → relax that vertical's negative regex OR add missing positives.
    ├─ False-positive → tighten positive OR add negative pattern.
    └─ Re-run dry-run until pass.
```

## Things NOT to do without re-confirming with operator

- Wipe prod KV (Phase 4 step) — destructive.
- Re-enable shared key for general public — pilot lockdown is still on.
- Push to main without `tsc --noEmit` clean + full vitest run green.
- Modify the cron route in `app/api/jobs/refresh/route.ts` while
  `260602-1739-hybrid-refresh-topup` is open — file-ownership conflict.

## Sideband — bot / abuse protection (queued for shared-key reopen)

Discussed 2026-06-03 night: visit-counter showed 105 views / 3 unique
IPs — diagnosed as normal admin testing (15-25 views per
nav-heavy session × 3 testers), NOT a DDoS signal. Decided to DEFER
hardening because while `DISABLE_SHARED_KEY=1` is on, abuse cost is
bounded (attackers force-fall to BYOK = their own API key, their own
spend). Hardening becomes mandatory the moment shared-key reopens.

Three layers to add, cheapest first, BEFORE flipping
`DISABLE_SHARED_KEY=0`:

| Order | Layer | Where | Effort |
|---|---|---|---|
| 1 | Vercel Firewall rate-limit on `/api/analyze`, `/api/jobs/recommend`, `/api/generate-cv` (30 req/min per IP → block 10m) | Vercel dashboard → Firewall | 30 min, no code |
| 2 | UA filter in `src/proxy.ts` — skip + 403 known crawlers (Googlebot, Bingbot, Censys, Shodan, Bytespider, AhrefsBot, etc.) | Middleware before `recordVisit` | 15 min, ~20 LOC |
| 3 | Vercel BotID (`@vercel/botid`) — fingerprint headless browsers and spoofers | Gate expensive paths | 1-2h |

Reasoning archived: visit counter only counts real page navigations
(prefetch + API + assets already excluded in proxy.ts:131), so the 105
number is the true page-nav count, not asset noise. Keep it as a public
marketing signal ("X views since launch") until reopen.

## Reference

- Plan overview: `plans/260603-1655-ingest-taxonomy/plan.md`
- Phase 2 doc (acceptance criteria): `plans/260603-1655-ingest-taxonomy/phase-02-vl24h-prefilter-rewrite.md`
- Taxonomy module: `cv-ex-refactor/src/lib/jobs/taxonomy.ts`
- Scrape script: `cv-ex-refactor/scripts/scrape-vl24h.ts`
- Memory anchors: `feedback-filter-before-scrape`,
  `project-ingest-freshness-constraint`, `project-post-pilot-db-migration`.
