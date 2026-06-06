# Phase 05 — Scraper Fleet: TopCV + VNW (parallel ingest to Postgres)

## Context Links

- Research: [research/topcv-vnw-scrape-recon.md](./research/topcv-vnw-scrape-recon.md)
- Template: `cv-ex-refactor/scripts/ingest-itviec.ts` (ITviec category-driven discovery)
- Cloudflare bypass: `cv-ex-refactor/scripts/fetch-via-curl.ts`
- Filter contract: `cv-ex-refactor/src/lib/jobs/taxonomy.ts` (from `260603-1655-ingest-taxonomy` Phase 1)
- Pipeline entrypoint: `cv-ex-refactor/scripts/ingest-file.ts` (`ingestEntries`)

## Overview

- Priority: P1
- Status: pending
- Effort: 8-12h
- Blocks: pool target only (independent of recommend cutover)
- Blocked by: 01 (DB exists), 02 (repo writes)

Port the ITviec ingest pattern to TopCV + VNW. Reuse `fetchViaCurl` for Cloudflare bypass. Reuse `taxonomy.ts` for filter-before-scrape. Both feed Postgres via Phase 02 repo. Target net new: 200+ jobs per refresh cycle to reach 1-2K pool.

## Key Insights

- Both boards are Cloudflare-gated (confirmed via WebFetch 403/404). NO Node fetch — straight to curl.
- Both expose JSON-LD JobPosting per Google for Jobs standard. Reuse `ldToJobInput` from ITviec parser.
- TopCV: category nav uses `viec-lam-{name}-c{id}.html` slugs. Detail: `/viec-lam/{slug}-{id}.html`.
- VNW: industry pages use `viec-lam-{name}-k{id}` slugs. Detail likely `/{slug}-{id}-jv` or `__NEXT_DATA__` fallback.
- Taxonomy module exists from older plan; ADD `SOURCES.topcv` + `SOURCES.vnw` entries with the verified slug whitelists.
- Apply filter-before-scrape at slug + listing-title BEFORE detail fetch (per `feedback_filter_before_scrape`).
- `ingestEntries` already writes via the new Postgres repo (from Phase 02 cutover); no scraper-side awareness of DB needed.

## Requirements

**Functional:**
- Two new scripts: `scripts/ingest-topcv.ts`, `scripts/ingest-vnw.ts` — same CLI shape as `ingest-itviec.ts`.
- Two new parsers in `src/lib/scrape/`: `topcv-parser.ts`, `vnw-parser.ts` (extract JobInput from detail HTML).
- Extend `src/lib/jobs/taxonomy.ts` `SOURCES` with topcv + vnw slug whitelists per vertical.
- Freshness filter `--max-age-days 3` honored.
- Anti-bot: 1500ms between listing pages, 1000ms between detail pages.

**Non-functional:**
- Each script run completes ≤10 min for 4 categories × 3 pages.
- Per-source filter-rejection counters logged (slug-reject, title-positive-fail, title-negative-match, freshness-fail).
- Structured-error surfacing on HTTP failures (no silent skip).

## Architecture

```
ingest-{board}.ts
  ├─ parseArgs (categories[], pages, dryRun)
  ├─ for each category:
  │    ├─ taxonomy.SOURCES[board][vertical].slugs check  ← reject if not whitelisted
  │    └─ for each page p:
  │         ├─ fetchViaCurl listing URL
  │         ├─ extract job-detail URLs (JSON-LD ItemList OR regex over <a>)
  │         ├─ for each card-title:
  │         │    └─ taxonomy.VERTICALS[v].subDomains positive+negative regex check
  │         └─ accumulate surviving URLs
  ├─ for each URL:
  │    ├─ fetchViaCurl detail page
  │    ├─ {board}Parser.parse(html) → JobInput
  │    └─ freshness check (postedAt ≥ now − 3d)
  └─ ingestEntries(survivors, label)
        ├─ classify (vertical+seniority if not set)
        ├─ embed (Gemini gemini-embedding-001)
        ├─ repo-postgres.saveJob (Phase 02 contract)
        └─ resolveCompany (existing v0.4 logic)
```

## Related Code Files

**To create:**
- `cv-ex-refactor/src/lib/scrape/topcv-parser.ts` — parse TopCV detail HTML → JobInput.
- `cv-ex-refactor/src/lib/scrape/vnw-parser.ts` — parse VNW detail HTML → JobInput (+ `__NEXT_DATA__` fallback).
- `cv-ex-refactor/scripts/ingest-topcv.ts` — CLI runner.
- `cv-ex-refactor/scripts/ingest-vnw.ts` — CLI runner.

**To modify:**
- `cv-ex-refactor/src/lib/jobs/taxonomy.ts` — add `SOURCES.topcv` + `SOURCES.vnw` slug maps + listing-card title selectors per board.
- `cv-ex-refactor/scripts/ingest-jobs.ts` (CLI dispatcher) — register new commands `topcv` + `vnw`.
- `cv-ex-refactor/package.json` — ensure `ingest topcv` + `ingest vnw` resolve.
- `docs/deployment.md` §13 — note 4 ingest sources now active.
- `docs/development-roadmap.md` — bump pool target milestone.

**To delete:** none.

## Implementation Steps

1. **TopCV parser:**
   - Try JSON-LD JobPosting in `<script type="application/ld+json">` → primary path.
   - Map `title` → JobInput.title, `hiringOrganization.name` → company, `description` → description (strip HTML), `jobLocation.address.addressLocality` → location, `datePosted` → postedAt ISO.
   - Detect must-haves: scan description for "Yêu cầu" / "Requirements" sections (best-effort regex), output `string[]`.

2. **VNW parser:**
   - Primary: JSON-LD JobPosting (same shape as TopCV).
   - Fallback: parse `<script id="__NEXT_DATA__">` JSON → navigate to `props.pageProps.job` (or similar; confirm during impl).
   - Same field mapping.

3. **TopCV ingest runner:**
   - Mirror `ingest-itviec.ts` structure exactly. Differences:
     - Listing URL builder: `https://www.topcv.vn/${slug}` (where slug from taxonomy).
     - Pagination: `?page=N`.
     - Card-title extraction: scan HTML for `<a class="job-title">…</a>` or rely on ItemList if present.

4. **VNW ingest runner:** same as TopCV, swap URL builder.

5. **Taxonomy additions:**
   ```ts
   SOURCES.topcv = {
     tech: { slugs: ['viec-lam-it-phan-mem-c10026.html', 'viec-lam-it-phan-cung-c10027.html', ...] },
     finance: { slugs: [...] },
     // ... per vertical
   };
   SOURCES.vnw = { /* analogous */ };
   ```
   - Slug lists from Phase 3 reconnaissance during impl (operator browses board nav for IDs).

6. **Filter-before-scrape integration:**
   - In listing pass, for each card title `t`:
     - Run `taxonomy.passesTitleFilter(t, vertical)` (existing helper from taxonomy.ts).
     - If false → log + skip (don't fetch detail).
   - Counts emitted at end: `slug=N title-pos-fail=N title-neg-match=N freshness-fail=N parsed=N saved=N`.

7. **Freshness gate:** `if (Date.now() - new Date(postedAt).getTime() > 3*24*3600*1000) skip`.

8. **CLI wiring:** `pnpm run ingest topcv {slug1} {slug2} --pages 3` → routes to `ingest-topcv.ts:run`.

9. **Dry-run mode:** `--dry-run` prints survivors w/o DB writes — for slug calibration without burning embed quota.

10. **Test on dev DB**: 1 category × 1 page → manually validate 5 results match the live site.

## Todo List

- [ ] Probe TopCV nav with curl; record slug IDs per vertical
- [ ] Probe VNW nav with curl; record slug IDs per vertical
- [ ] Write src/lib/scrape/topcv-parser.ts + unit test with fixture HTML
- [ ] Write src/lib/scrape/vnw-parser.ts + __NEXT_DATA__ fallback + unit test
- [ ] Extend taxonomy.ts SOURCES with topcv + vnw entries
- [ ] Write scripts/ingest-topcv.ts (mirror ITviec pattern)
- [ ] Write scripts/ingest-vnw.ts
- [ ] Register topcv + vnw in scripts/ingest-jobs.ts dispatcher
- [ ] Dry-run each board against 1 category to validate slug + title filters
- [ ] Full run: aim for 50+ TopCV + 50+ VNW per first cycle
- [ ] Update docs (deployment §13, roadmap milestone)

## Success Criteria

- Each board returns ≥50 surviving JobInput per first run (4 categories × 2-3 pages).
- Per-vertical Postgres pool reaches ≥150 in tech, ≥75 in each of marketing/finance/sales/ops within 2 cycles.
- Zero unhandled exceptions over a full run (errors classified + reported, not swallowed).
- 20-job manual sample per source shows ≥85% precision (no off-vertical bleed).

## Risk Assessment

| # | Risk | L | I | Mit |
|---|---|---|---|---|
| 1 | TopCV blocks curl with different fingerprint than ITviec | M | M | First fall back to `curl --tls-max 1.3 -A '<chrome UA>'`; if still blocked, try curl-impersonate (chrome120 build). Document in fetch-via-curl.ts. |
| 2 | VNW JSON-LD absent → fallback parser breaks on schema change | M | M | Two-layer parser (JSON-LD primary, __NEXT_DATA__ fallback). Emit `parser_path` in log. |
| 3 | Slug taxonomy drift (TopCV adds/removes category) | L | M | Weekly unmapped-slug audit (defer to cron in Phase 8 follow-up); for now, operator checks during scheduled runs |
| 4 | Description HTML stripping mangles VN text encoding | L | L | Use existing `extract-readability.ts` patterns; test with 5 VN samples |
| 5 | Burst of new ingest blows past Gemini embed quota (5 req/s free tier) | M | L | embed.ts already throttles to 5 req/s; 200 new jobs / cycle = ~40s overhead, acceptable |

## Security Considerations

- Scraped content includes company emails / phones (sometimes). Don't index PII unintentionally — the JobInput.description already passes through existing sanitizer.
- robots.txt respect: ITviec + vl24h ingest currently ignore robots.txt; TopCV + VNW likely disallow `/api/`. We're scraping public listing/detail HTML only, which is allowed under the same precedent. Doc the decision in `docs/code-standards.md` ingest section.

## Rollback Plan

- New scripts + parsers are isolated files. `git revert` removes them; existing ITviec + vl24h ingest unaffected.
- If a botched run pushed bad rows: `DELETE FROM jobs WHERE source IN ('topcv','vnw') AND created_at > <run-time>` — kept as one-off cleanup script.

## Next Steps

- Phase 06 + 07 run in parallel with this phase's ingest cycles.
- Phase 8 evaluates per-vertical floor; if any vertical <50, extend slug lists or add 4th source (careerlink, careerviet).
