# Runbook — Pre-2K live ingest (operator)

Date: 2026-06-07 12:45 ICT
Target: grow active pool from 171 → ≥2,000 jobs across 6 verticals.
Branch: `main` (commits to push: `53575da`, `f820bb7`, plus today's pre-2K hardening).

## Prereqs (do once, ≤5 min)

1. **Paste `GEMINI_API_KEY` into `.env.local` MANUALLY.** It's a Sensitive Vercel env var; `vercel env pull` leaves it masked (per memory `feedback_vercel_sensitive_env_pull_masked`). Source value from Google AI Studio (your operator key, NOT a shared app key).
2. **Confirm `DATABASE_URL` + `DATABASE_URL_UNPOOLED` are present in `.env.local`.** They come down via `vercel env pull` if you ran it recently. If not, `vercel env pull .env.local --environment=production` then re-add the Gemini key.
3. **Confirm `KV_REST_API_URL` + `KV_REST_API_TOKEN` are present** (needed for company resolver alias cache + companies sidecar).
4. **Confirm git is on `main` with both 53575da + f820bb7 + the new pre-2K commit applied.**
5. **Push to main when ready:** the commits land on Vercel auto-deploy in <2 min. Live ingest writes to the same Postgres the prod recommend route reads — no separate environment.

## Hard guards in place (won't bypass silently)

| Constraint | Where | Behavior |
|---|---|---|
| Posted ≤3 days ago | `scripts/ingest-urls.ts` → `MAX_AGE_DAYS=3` | Reject; logs `Too old (datePosted=…, cap=3d)` |
| Missing datePosted | same | Reject; logs `No datePosted in JSON-LD (freshness unverifiable)` |
| Expired validThrough | same | Reject; logs `Expired (validThrough=…)` |
| Description <50 chars | same | Reject; logs `Description too short` |
| Duplicate by sha256(sourceUrl) | `scripts/ingest-file.ts` → `isActiveJob` (Postgres) | Skip; logs `Skip dup: <title>` |
| Embed throttle | `src/lib/jobs/embed.ts` | 5 rps token bucket |
| Cloudflare bypass | `scripts/fetch-via-curl.ts` | System curl, Chrome UA + sec-ch-ua |

Override freshness only if you have a clear reason: `INGEST_MAX_AGE_DAYS=7 pnpm run ingest topcv ...`. Do NOT go above 14 — stale jobs degrade Job Fit quality.

## What's in the new pipeline (since 2026-06-07 EOD-6-6 baseline)

- Ingest writes go to **Postgres** (not KV). Recommend route already reads from PG (`JOBFIT_USE_POSTGRES=1`). KV `repo.ts` is deprecated and awaits Phase 8 decommission.
- Companies sidecar (`companies:active-jobs:{slug}`) stays on KV. Not breaking.
- VNW runner is **parked** — discovery still works (`--dry-run`) but detail-fetch exits early. VNW detail pages are pure CSR; cannot extract postedAt or rich description without a headless browser. Use TopCV + ITviec + vl24h to hit 2K. See `recon-260607-1126-topcv-vnw-url-scheme-drift.md`.

## Yield estimates (verified live)

| Source | URLs per cycle | Notes |
|---|---|---|
| TopCV `tim-viec-lam-*` | ~50/slug/page × server-paged 3 pages | Server-side pagination. `tim-viec-lam-lap-trinh-vien` ≈ 130+ unique URLs in 3 pages. |
| TopCV `viec-lam-it` (broad) | ~50-90 unique across 3 pages | Carousel rotates; dedup catches overlap. |
| ITviec | existing — re-run | per current `ingest-itviec.ts` defaults |
| vl24h | existing — re-run | per current `scrape-vl24h.ts` |
| VNW | 0 | Parked. |

**Math to 2K (after freshness + dedup ≈ 60% pass rate):**
- TopCV: 5 slugs × 3 pages × 50 = 750 URLs raw → ≈ 450 ingested.
- ITviec: 4 keyword runs ≈ 80 URLs raw → ≈ 50 ingested.
- vl24h: existing scrape ≈ 200-400 URLs raw → ≈ 150-250 ingested.
- Existing pool: 171 (some may expire on first re-classify).
- **Total: ~821-921 → run cycle 2x to clear ≥2K, OR add 5-10 more TopCV slugs from `tim-viec-lam-{kw}-cr{id}` form.**

## Execution sequence (run sequentially, monitor each)

```powershell
# ── Cycle 1: TopCV tech ──────────────────────────────────────────────────
# Server-paged slugs first (highest yield)
pnpm run ingest topcv tim-viec-lam-lap-trinh-vien --pages 3
pnpm run ingest topcv tim-viec-lam-it-phan-mem --pages 3
pnpm run ingest topcv tim-viec-lam-data-engineer --pages 3
pnpm run ingest topcv tim-viec-lam-cong-nghe-thong-tin-cr257 --pages 3
# Broad nav category — carousel pagination, smaller marginal yield
pnpm run ingest topcv viec-lam-it --pages 2

# Quick state check
pnpm run ingest stats

# ── Cycle 2: TopCV non-tech ──────────────────────────────────────────────
# Use these slugs (verified live) to hit non-tech verticals
pnpm run ingest topcv tim-viec-lam-ke-toan tim-viec-lam-marketing --pages 3
pnpm run ingest topcv tim-viec-lam-nhan-vien-kinh-doanh --pages 3
pnpm run ingest topcv tim-viec-lam-hanh-chinh-nhan-su --pages 3
pnpm run ingest topcv tim-viec-lam-ngan-hang --pages 3

pnpm run ingest stats

# ── Cycle 3: ITviec + vl24h refresh (existing scrapers) ──────────────────
pnpm run ingest itviec data-engineer senior-data-engineer backend-developer devops --pages 3
pnpm tsx scripts/scrape-vl24h.ts --max-age-days 3
# (vl24h scraper has its own flags; refer to scripts/scrape-vl24h.ts --help)

pnpm run ingest stats
```

Between cycles, check `pnpm run ingest stats` for vertical breakdown. Aim for ≥150/vertical for tech, ≥100 others (matches plan success metric).

## What to watch in the log

- `Skip dup: …` — expected on re-runs; means dedup works.
- `Too old (datePosted=… cap=3d)` — expected; freshness filter at work.
- `No datePosted in JSON-LD` — unexpected if widespread; probe the URL via curl to see if TopCV started omitting `datePosted` for that listing.
- `resolveCompany failed for "…"` — proceeds without companyId; common for new companies on cold cache.
- `Embedding: title @ company` — confirms PG-backed ingest in progress.

## After ingest cycles complete

1. **Sanity-check pool size:**
   ```powershell
   pnpm run ingest stats
   ```
   Expect: `active` ≥2000, balanced across 6 verticals.

2. **Smoke recommend endpoint** (already PG-backed, but verify):
   ```powershell
   # Anon (1 tier-B teaser)
   curl -X POST https://resume-refactor.vercel.app/api/jobs/recommend `
     -H "Content-Type: application/json" `
     -d '{"cv":"...","topK":1}'
   # Authenticated paid (10 jobs, mixed tiers) — needs session cookie
   ```

3. **Check vertical distribution:**
   ```powershell
   psql $env:DATABASE_URL -c "SELECT vertical, COUNT(*) FROM jobs WHERE active=true GROUP BY vertical ORDER BY 2 DESC;"
   ```

4. **Commit + push** the pre-2K hardening commits (53575da + f820bb7 + today's commit).

## Rollback (if something breaks mid-cycle)

- **Interrupt:** Ctrl+C. ingestEntries writes `data/ingest-progress.json` on SIGINT.
- **Resume:** `pnpm run ingest file data/<last-batch>.json` — dedup re-runs, no duplicate inserts.
- **Bad ingest landed in PG:** mark active=false for affected `verifiedAt > '<timestamp>'`:
  ```sql
  UPDATE jobs SET active=false WHERE verified_at > '2026-06-07 13:00:00';
  ```

## Phase 8 KV decommission

Still gated on 72h Phase 4 observation (started 2026-06-06) → earliest **2026-06-09**. After successful 2K ingest, Phase 4 + Phase 8 observation windows overlap — count from the LATER of the two.

## Known limitations (not blocking 2K)

- VNW: parked. Future re-enable needs headless browser or reverse-engineered ms.vietnamworks.com API.
- TopCV broad `/viec-lam-it`: client-side carousel pagination. Don't use `--pages > 2` on broad nav routes; use `tim-viec-lam-*` instead.
- tech.qa + tech.product-tech: no VNW seeds, limited TopCV seeds. Will be under-represented.
- ITviec scraper accuracy: existing behavior, no Phase 5 changes.
