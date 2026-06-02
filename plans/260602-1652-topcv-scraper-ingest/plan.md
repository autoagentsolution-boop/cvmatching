# TopCV Scraper → Ingest 150 Real Jobs (v0.3 post-ship)

**Created:** 2026-06-02 16:52
**Branch:** main
**Status:** 📋 Planned — ready to execute
**Predecessor:** v0.3 P0–P5 shipped (commit `0c42050`). Pre-prod gate "150 real jobs ingest" still pending.

---

## Context (resume cold)

### Current state — verified this session

| Item | State | Evidence |
|---|---|---|
| `ADMIN_USER_IDS` env on Vercel | ✅ Set (Sensitive) | `vercel env ls production` |
| `EMBED_CACHE_SECRET` env on Vercel | ✅ Set (Sensitive) | `vercel env ls production` |
| Vercel project link | ✅ `data-agentic-solutions-projects/cvmatching` | `.vercel/project.json` at repo root |
| `cv-ex-refactor/.env.local` populated | ✅ for ingest CLI | `GEMINI_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` filled manually |
| KV connection | ✅ verified | `pnpm run ingest stats` → `{ active: 0, expired: 0 }` |
| Prod KV job count | **0 active jobs** | Recommend endpoint returning empty since v0.3 ship |
| `data/seed-jobs.json` | 10 entries, ALL `_stub` markers | Not usable for prod ingest |

### Critical gotchas (carried from this session)

1. **Vercel "Sensitive" vars cannot be pulled via CLI.** `vercel env pull` returns empty strings for encrypted secrets. Fix: user filled `cv-ex-refactor/.env.local` manually from Upstash dashboard (KV_*) + AI Studio (GEMINI). Repeat for any new sensitive var.
2. **TWO `.env.local` files exist:**
   - `C:\Users\Vincere\Desktop\Claude\CVMatching\.env.local` (repo root, from `vercel env pull`)
   - `C:\Users\Vincere\Desktop\Claude\CVMatching\cv-ex-refactor\.env.local` (where ingest CLI reads — `tsx --env-file=.env.local` resolves to CWD)
   Always edit the **cv-ex-refactor** one for CLI work.
3. **Zod schema rejects empty `=""`.** `AUTH_SECRET=""` and `EMBED_CACHE_SECRET=""` fail `min(32)` even if `.optional()`. For ingest-only work, **delete those lines** (don't leave empty).
4. **Vercel link is at repo root, not in cv-ex-refactor.** CLI walks up to find it. Running `vercel link --yes` from cv-ex-refactor accidentally created an empty `cv-ex-refactor` project — already cleaned up by relinking with `--project cvmatching`.
5. **System reminder said "Vercel CLI not installed" — WRONG.** CLI 54.7.1 is installed at `C:\Users\Vincere\AppData\Roaming\npm\vercel`. Ignore that hint.

### Constraint (persisted to memory)

Every ingested job must be:
- **Real** (not stub)
- **Currently open** (HTTP 200 + no "expired/filled" markers)
- **Posted ≤ 3 days ago**

See `memory/project_ingest_freshness_constraint.md`.

---

## Plan: TopCV-only scraper

### Why TopCV (decided this session)

- Covers **all 6 verticals** the system supports (`tech | marketing | finance | sales | ops | other`) — one source = simpler vs ITviec (tech-only)
- Source enum already supports `'topcv'` in `src/lib/jobs/types.ts:17`
- Light anti-bot (no aggressive Cloudflare)
- Vietnamese-language jobs match target audience
- `postedAt` exposed as "Đăng X ngày trước" — parseable

If TopCV tech quality is noisy, layer ITviec on top later for vertical=tech.

### Architecture

```
scripts/scrape-topcv.ts          # NEW — listing crawler + filter + dedup + output JSON
src/lib/scrape/topcv-parser.ts   # NEW — parse listing card + detail page HTML
data/scraped-{ISO}.json          # Output (gitignored), feeds `pnpm run ingest file`
```

Reuse existing infra:
- `src/lib/scrape/fetch-html.ts` — HTTP fetcher with UA + retry
- `src/lib/scrape/extract-readability.ts` — strip nav/footer from job detail pages
- `src/lib/scrape/detect-antibot.ts` — bail if blocked
- `scripts/ingest-jobs.ts file <path>` — already handles JSON array, dedup by sourceUrl, classify, embed, save to KV

### Coverage strategy

Target ~25 jobs × 6 verticals = 150 jobs.

TopCV category URLs (verify exact slugs during probe):
- `topcv.vn/viec-lam-it` → tech
- `topcv.vn/viec-lam-marketing` → marketing
- `topcv.vn/viec-lam-tai-chinh-ngan-hang` → finance
- `topcv.vn/viec-lam-kinh-doanh` → sales
- `topcv.vn/viec-lam-hanh-chinh-van-phong` → ops
- `topcv.vn/viec-lam-khac` → other (or rotate misc categories)

For each: pull page 1-2 sorted by newest, filter `postedAt ≤ 3d`, dedup by URL.

---

## Tasks

- [ ] **T1. Probe TopCV HTML structure** — 1 category, 1 page. Confirm: listing card selectors, individual posting URL pattern, postedAt field location & format ("Đăng 1 ngày trước"). Use `curl -A "Mozilla/5.0..."` first to check raw response.
- [ ] **T2. Build `topcv-parser.ts`** — pure functions: `parseListingCards(html) → Card[]` and `parseDetailPage(html) → JobInput`. Card includes `sourceUrl`, `title`, `company`, `postedAtRelative`.
- [ ] **T3. Build `scripts/scrape-topcv.ts`** — orchestrate:
  - Loop categories
  - Fetch listing → parse cards
  - Filter by parsed `postedAt` (relative → absolute, drop if >3d)
  - Dedup by sourceUrl
  - Fetch each detail page (rate-limited 1 req/2s)
  - Output to `data/scraped-{ISO}.json` matching `JobInput` schema
- [ ] **T4. Dry-run mode flag** — `--dry-run` skips writing output, prints summary (count by vertical, oldest postedAt, dedup hits)
- [ ] **T5. Test with 10 records** — single category, limit=10, verify JSON schema matches `JobInput`, fields populated correctly
- [ ] **T6. Run full 150** — all 6 categories, write to `data/scraped-{ISO}.json`
- [ ] **T7. Ingest** — `pnpm run ingest file data/scraped-{ISO}.json` → embed via Gemini → save to prod KV → verify with `pnpm run ingest stats`
- [ ] **T8. Smoke `/api/jobs/recommend`** — login on prod, upload a CV, confirm 5+ matches returned with real titles

### Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| TopCV adds Cloudflare mid-scrape | Low | Add UA rotation + `detectAntibot` fail-fast; fallback playwright if needed |
| Rate-limit ban during 150-job fetch | Med | 2s delay between requests; resume from `data/ingest-progress.json` (already supported by ingest-file.ts) |
| `postedAt` parsing edge cases ("Đăng hôm nay", "Đăng vừa xong") | High | Test parser against 20+ sample strings before T6 |
| Some categories have <25 fresh jobs | Med | Allow up to 50 per category, rebalance to hit 150 total |
| Gemini embed quota during 150-job ingest | Low | 150 calls × 1 embed = 150 calls/day, well under free tier 1500/day |
| Bad classify (e.g., "Marketing Manager (Tech startup)" → marketing not tech) | Low | Heuristic in `classify.ts` is fine; LLM not used at ingest — won't worsen |

---

## Resume instructions (next session)

```powershell
cd C:\Users\Vincere\Desktop\Claude\CVMatching\cv-ex-refactor

# Verify env still loaded
pnpm run ingest stats

# Expected output: {active: 0, expired: 0, ...} — if env error, see "Critical gotchas" above

# Start work on T1: probe TopCV
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -s "https://www.topcv.vn/viec-lam-it" | head -200
```

After T1, decide:
- HTML straightforward → continue T2 with cheerio
- Cloudflare/JS-rendered → pivot to playwright

---

## Files referenced

- `cv-ex-refactor/src/lib/jobs/types.ts:17` — source enum, JobInput type
- `cv-ex-refactor/src/lib/jobs/classify.ts` — vertical + seniority heuristics
- `cv-ex-refactor/scripts/ingest-jobs.ts` — CLI dispatcher
- `cv-ex-refactor/scripts/ingest-file.ts:67-101` — embed + save flow
- `cv-ex-refactor/src/lib/scrape/fetch-html.ts` — reusable HTTP fetcher
- `cv-ex-refactor/data/seed-jobs.json` — 10 stub jobs (do NOT use for prod)
- `plans/260529-1031-job-fit-study/phase-01-ingest-cli-and-seed.md` — original ingest spec

## Open questions

- TopCV anti-bot behavior under sustained crawl — only known after probe (T1)
- Whether `vnw` (VietnamWorks) needed as secondary source if TopCV finance/ops listings sparse
- Future: scheduled refresh cron (`/api/jobs/refresh` exists at phase-04) — should it re-run scraper or just verify open status of existing?
