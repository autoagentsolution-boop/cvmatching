# Research R3 — TopCV + VietnamWorks scraping reconnaissance

**Date:** 2026-06-06
**For:** plan `260606-1231-jobfit-db-pool-monetize`
**Method:** WebFetch probes + web search; full structural recon happens during Phase 5 implementation with `fetchViaCurl`.

---

## TL;DR

| Board | Cloudflare-gated | Sitemap exists | JSON-LD JobPosting | ItemList pattern | Recommended pattern |
|---|---|---|---|---|---|
| TopCV (topcv.vn) | Yes (403 to Node fetch + WebFetch) | Yes (e.g. `/sitemap/companies_329.xml`, expect `/sitemap.xml` index) | Highly likely (Google-jobs SEO standard) | Listing page likely embeds; needs curl confirm | Reuse `fetchViaCurl` + ITviec-style category-driven discovery |
| VietnamWorks (vietnamworks.com) | Yes (404/403 to WebFetch) | Likely yes (large SEO investment) | Highly likely | Listing API may be JSON (next.js __NEXT_DATA__) | curl + parse __NEXT_DATA__ OR sitemap-driven detail crawl |

## Confirmed: Cloudflare gates both

Both boards returned 403/404 to WebFetch (different TLS fingerprint than browser). This matches the project memory `feedback_cloudflare_node_fetch_blocked` from ITviec experience. **Decision: reuse `scripts/fetch-via-curl.ts` for both.** Do not waste cycles on Node fetch header tuning.

## TopCV — discovery strategy

Per ITviec template (see `scripts/ingest-itviec.ts`):

1. **Category-driven listing fetch.** TopCV nav uses URLs like:
   - `https://www.topcv.vn/viec-lam-it-phan-mem-c10026.html` (software category)
   - `https://www.topcv.vn/viec-lam-it-phan-cung-c10027.html`
   - `https://www.topcv.vn/viec-lam-ke-toan-c1.html`
   - Slug pattern: `viec-lam-{vn-category-name}-c{numeric-id}.html`

2. **Listing → detail link extraction.** Cards on listing pages render `<a href="/viec-lam/{slug}-{numeric-id}.html">`. Two extraction options:
   - JSON-LD ItemList in `<head>` (if present, mirror ITviec parser)
   - Regex over rendered `<a>` tags as fallback

3. **Detail page JSON-LD.** TopCV has Google for Jobs structured data → `<script type="application/ld+json">{ "@type": "JobPosting", ... }</script>`. Same `ldToJobInput` parser from ITviec should work with minimal field-mapping tweaks (`hiringOrganization.name`, `datePosted`, `description`, `jobLocation.address.addressLocality`).

4. **Pagination.** `?page=N` query param (industry standard). Hit until <5 cards returned.

## VietnamWorks — discovery strategy

1. **URL slug pattern (research-inferred).** Listing pages use:
   - `https://www.vietnamworks.com/viec-lam-cong-nghe-thong-tin-k1` (industry "k1" = IT)
   - `https://www.vietnamworks.com/viec-lam-ke-toan-kiem-toan-k4`
   - Slug pattern: `viec-lam-{slug}-k{industry-id}` (no `.html`)

2. **Detail URLs.** `/{job-slug}-{numeric-id}-jv` is the conventional pattern on Vietnamese job boards using "job view" suffix.

3. **JSON-LD likely present.** VietnamWorks is a Navigos Group property with mature SEO; JobPosting markup expected. Confirm during implementation.

4. **Backup channel: __NEXT_DATA__.** If JSON-LD absent, vietnamworks.com is Next.js — `<script id="__NEXT_DATA__">` carries full SSR payload including job objects. Parse it as a 2nd-pass fallback.

## Shared parser contract

Both new parsers MUST produce `JobInput` matching `src/lib/jobs/types.ts` so the existing `ingestEntries(entries, label)` pipeline accepts them unchanged. Fields:

```ts
{
  title: string;
  company: string;
  description: string;
  sourceUrl: string;
  source: 'topcv' | 'vnw';   // already in Job source union
  location: string;
  postedAt: string;          // ISO; must satisfy --max-age-days 3 filter
  vertical?: Vertical;       // taxonomy classifier fills if absent
  seniority?: Seniority;     // ditto
  subVertical?: string;      // from taxonomy slug match
  mustHaves?: string[];      // best-effort from description
}
```

## Filter-before-scrape application

Per memory `feedback_filter_before_scrape` and `plans\260603-1655-ingest-taxonomy\phase-01`:

1. URL slug whitelist check against `taxonomy.ts` `SOURCES.topcv[v].slugs` (new key for the topcv source) BEFORE listing-page fetch.
2. Listing-card title regex check (positive + negative from `taxonomy.ts` VERTICALS[v].subDomains) BEFORE detail-page fetch.
3. Only detail HTML download for surviving URLs.

This means Phase 1 of the OLD plan dir (`260603-1655-ingest-taxonomy`) is still load-bearing — its `src/lib/jobs/taxonomy.ts` module is the contract both new parsers consume.

## Estimated yield

| Board | Categories of interest | Listing pages × cards/page | Pre-filter pass rate | After freshness (≤3d) | Net new jobs / run |
|---|---|---|---|---|---|
| TopCV | 4 (IT, accounting, sales, marketing) | 2-3 × ~20 | ~40% | ~30% | ~50-100 |
| VNW | 4 same | 2-3 × ~20 | ~40% | ~30% | ~50-100 |
| ITviec (existing) | — | — | — | — | ~30-50 (already running) |
| vl24h (existing) | — | — | — | — | ~70-120 (already running) |

Combined per refresh cycle: **~200-370 net new candidates** → easily clears 1-2K pool target across 1-2 refresh cycles.

## Anti-bot etiquette

- Same delays as ITviec: 1500ms between listing pages, 1000ms between detail pages.
- User-Agent: rotate among 3-4 modern Chrome strings (curl `-A` flag).
- One scrape run per board per cron tick (don't parallelize across boards in same minute).
- If 403 mid-run → backoff 60s, retry once, then abort with structured error per `feedback_error_surfacing_no_silent_fallback`.

## Risks

| # | Risk | Mit |
|---|---|---|
| 1 | TopCV blocks curl after pattern detection | Same TLS fingerprint as ITviec where it works; if blocked, switch to chrome-tls-impersonate flag in curl |
| 2 | VNW doesn't emit JSON-LD | Fall back to __NEXT_DATA__ parser; if that fails too, defer VNW to follow-up plan and rely on ITviec+TopCV+vl24h trio (still hits pool target) |
| 3 | Taxonomy slug mapping wrong for new sources | Phase 5 starts with a dry-run audit: log-only per-slug counts before any KV/DB writes |

## Sources

- WebFetch probes (both returned 403/404)
- [TopCV sitemap example](https://www.topcv.vn/sitemap/companies_329.xml)
- [Google for Jobs JSON-LD JobPosting spec](https://developers.google.com/search/docs/appearance/structured-data/job-posting)
- Project memory: `feedback_cloudflare_node_fetch_blocked`, `feedback_filter_before_scrape`
- Existing `cv-ex-refactor/scripts/ingest-itviec.ts` (template)
