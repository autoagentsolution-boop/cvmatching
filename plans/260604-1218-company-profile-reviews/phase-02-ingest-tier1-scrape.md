# Phase 2 — Ingest Tier 1 Scrape (Company Page Extraction)

**Effort:** 2-3h
**Owner:** lead
**Status:** pending
**Blocked by:** phase 1
**Blocks:** phase 4

## Goal

When ingest encounters a new company (alias miss → mint), fetch that company's profile page on the source site and populate Tier 1 fields (industry, sizeRange, hqLocation, website, logoUrl, description). 90d TTL with lazy auto-refetch. Failure → stub with `tier1Pending: true`, retry on next ingest run.

## Files to Create

- `src/lib/scrape/companies/itviec-company.ts` — ≤ 120 lines, parses `https://itviec.com/companies/{slug}` profile pages
- `src/lib/scrape/companies/topcv-company.ts` — ≤ 120 lines
- `src/lib/scrape/companies/vnw-company.ts` — ≤ 120 lines (vietnamworks.com/employers/...)
- `src/lib/scrape/companies/vl24h-company.ts` — ≤ 120 lines (often inline on job page, less rich)
- `src/lib/scrape/companies/index.ts` — `scrapeCompanyPage(source, sourceCompanyUrl)` dispatcher
- `src/lib/scrape/companies/itviec-company.test.ts` etc. — fixture HTML per source under `tests/fixtures/companies/`

## Files to Modify

- `scripts/ingest-jobs.ts` — after `resolveCompany` returns `created: true`, async-fire Tier 1 scrape; on stale (`tier1ExpiresAt` past) for existing slug, also refire. Block-or-not policy: **non-blocking** — Tier 1 scrape runs in parallel with embedding generation; if fails, job still ingests, company has stub.
- `src/lib/jobs/classify.ts` — when scraping job detail, capture `sourceCompanyUrl` (link to company profile on the source) into `JobInput` so Phase 2 has the URL to fetch.

## Per-Source Selectors (research first if uncertain)

| Source | Profile URL pattern | Key selectors |
|---|---|---|
| ITviec | `/companies/{slug}` | `.company-overview`, `.company-size`, `.company-industry`, `.company-address`, `.company-website`, `.company-logo img[src]`, `.about-us p` |
| TopCV | `/cong-ty/{slug}` | `.company-info`, `[data-field="size"]`, `[data-field="industry"]`, `.company-address`, `.company-website a[href]`, `.company-logo img`, `.company-description` |
| VietnamWorks | `/employers/{id}` | `.employer-info`, `.employer-size`, `.employer-industry`, `.employer-location`, `.employer-website`, `.employer-logo img`, `.employer-about` |
| VL24H | inline on job detail | `.cong-ty-info`, often only name + address; minimal Tier 1, expect heavy reliance on Phase 5 LLM enrichment |

**Note:** selectors are starting points — Phase 2 step 1 verifies live, adjusts. Document final selectors in each parser file's top comment.

## SizeRange Normalization

Source values vary ("100-499 nhân viên", "1000+", "501 - 1000 employees"). Single util `parseSizeRange(raw: string): Company['sizeRange'] | undefined` mapping to the 5 buckets in types.ts. Test fixtures cover 20+ source phrasings.

## Data Flow Integration

```
scripts/ingest-jobs.ts (existing flow):
  parse job detail → JobInput (with sourceCompanyUrl)
                   ↓
  resolveCompany(rawName) → { slug, created, provisional }
                   ↓
  attach companyId = slug to JobInput
                   ↓
  if (created || tier1Stale(co.tier1ExpiresAt))
    fireAndForget: scrapeCompanyPage(source, sourceCompanyUrl)
                     ↓
                   on success: update co:{slug} with Tier 1 fields, tier1ExpiresAt = now + 90d
                   on fail: set tier1Pending = true, log + Pushover on 3 consecutive fails
                   ↓
  continue: embed → save Job → vertical-index rebuild
```

`fireAndForget` runs via Promise.allSettled batch at end of ingest run — not per-job blocking. Caps in-flight scrapes at 5 concurrent (existing scrape concurrency cap).

## Implementation Steps

1. Verify source company-page selectors live: open 3 sample profile URLs per source (ITviec, TopCV, VNW), confirm DOM structure matches table above. Adjust selectors. Save raw HTML to `tests/fixtures/companies/{source}-{slug}.html`.
2. Build `parseSizeRange` util (could live in `lib/companies/normalize.ts` if small, or new `lib/companies/size-parse.ts`). 20+ fixtures.
3. Implement each source parser. Same signature: `parseCompanyPage(html: string, url: string): Partial<Company> & { tier1Pending?: false }`.
4. Implement dispatcher `scrapeCompanyPage(source, url)` — wraps existing `fetch-html.ts` (with anti-bot detection from `detect-antibot.ts`), calls source parser, returns `{ ok: true, data } | { ok: false, reason }`.
5. Wire into `scripts/ingest-jobs.ts`:
   - After `resolveCompany`, push to `tier1ScrapeQueue: Array<{ source, url, slug }>`
   - After main ingest loop, `await Promise.allSettled(queue.map(item => withConcurrency(5, () => scrape...)))`
   - Per item: on success, `updateCompany(slug, { ...tier1Fields, tier1ScrapedAt: now, tier1ExpiresAt: now+90d, tier1Pending: false })`; on fail, set `tier1Pending: true`, log `companyScrapeFailure` counter.
6. Per-source unit tests: load fixture HTML, assert parsed fields.
7. Integration smoke test: run ingest against 1 fixture job per source end-to-end, assert `co:{slug}` populated.
8. Add `companyScrapeFailRate` to existing ingest stats output.

## Acceptance Criteria

- [ ] 4 source parsers extract: industry, sizeRange, hqLocation, website, logoUrl, description (where present)
- [ ] `parseSizeRange` covers 20+ phrasings (test asserts)
- [ ] Ingest run on 10 jobs spanning 4 sources produces 10 populated `co:{slug}` entries
- [ ] Failure case: simulated 503 from source → stub created with `tier1Pending: true`, ingest doesn't abort
- [ ] Refresh case: backdated `tier1ExpiresAt` → next ingest re-fires scrape, updates fields
- [ ] No regression in existing job ingest (`pnpm vitest run scripts/ingest-jobs`)

## Risks

- **Selector drift**: source sites redesign → silent extraction returns empty fields. Mitigation: per-parser sanity check — require ≥3 of 6 fields non-empty; <3 → treat as failure, log + alert.
- **Rate limit on bulk first-ingest**: 100 new companies on a single run × 4 sources = throttling. Mitigation: 5-concurrency cap + 200ms jitter; if 429 → exponential backoff up to 3 retries, then stub-and-defer.
- **VL24H sparse profile data**: minimal Tier 1 fields. Mitigation: expected — Phase 5 LLM enrichment compensates; flag in UI as "thông tin hạn chế".
- **Logo CDN hotlink protection**: source CDN may 403 to our domain at render time. Mitigation: Phase 4 graceful image-error fallback (hide), self-host deferred to Phase 8.

## Security

- HTML parsing via existing readability pipeline — no XSS surface
- Stored URLs (`website`, `logoUrl`) untrusted; UI must rel="noopener noreferrer" + image error handler
- No PII in Tier 1 fields (industry, size, address, website — all corporate)

## Next Phase

→ phase-04-ui-company-card.md (needs phases 1, 2, 3)
