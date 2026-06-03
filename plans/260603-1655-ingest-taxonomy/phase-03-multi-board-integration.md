# Phase 3 — Multi-Board Probe (TopCV + VietnamWorks)

**Effort:** 4-6h
**Blocked by:** phase 2
**Status:** STRETCH — skip if Phase 4 already hits success metrics on vl24h alone

## Goal

Extend filter-before-scrape to two more boards under the same `taxonomy.ts` contract. Verify pool diversification (different companies, different role distribution) without doubling the maintenance surface.

## Files to Create

- `src/lib/scrape/topcv-parser.ts` — listing + detail parser (mirrors vl24h-parser shape)
- `src/lib/scrape/vnw-parser.ts` — same, for vietnamworks.com
- `scripts/scrape-topcv.ts` — bucket loop driven by `TAXONOMY[v].subDomains.*.sourceSlugs.topcv`
- `scripts/scrape-vnw.ts` — same for vnw

## Files to Modify

- `src/lib/jobs/taxonomy.ts` — populate `sourceSlugs.topcv` and `sourceSlugs.vnw` arrays per sub-domain (currently only vl24h is filled in Phase 1)
- `src/lib/jobs/types.ts` — already has `source: 'itviec' | 'topcv' | 'vnw' | 'vl24h' | 'other'`; no change needed

## URL Patterns (from taxonomy research)

**topcv.vn:**
- Listing pattern: `https://www.topcv.vn/tim-viec-lam-{role-slug}` (no sitemap discovered in research)
- Detail pattern: `https://www.topcv.vn/viec-lam/{title-slug}/{id}.html`
- Approach: scrape listing pages directly (HTML), extract title + detail URL from each card
- Known role slugs (from taxonomies):
  - tech: `tim-viec-lam-it-phan-mem`, `tim-viec-lam-devops`, `tim-viec-lam-data-engineer`, `tim-viec-lam-machine-learning`, `tim-viec-lam-cloud`, `tim-viec-lam-security`, `tim-viec-lam-qa-tester`
  - sales: `tim-viec-lam-sale` (11,909 jobs), sub via `tim-viec-lam-nhan-vien-kinh-doanh`, `tim-viec-lam-telesales`, `tim-viec-lam-account-manager`
  - marketing: `tim-viec-lam-marketing`, `tim-viec-lam-digital-marketing`, `tim-viec-lam-seo`, `tim-viec-lam-content`
  - finance: `tim-viec-lam-ke-toan`, `tim-viec-lam-kiem-toan`, `tim-viec-lam-tai-chinh`
  - ops + other: TBD via probe
- **Negative slug examples** (research-confirmed): `tim-viec-lam-ky-su-co-khi` (mechanical), `tim-viec-lam-ky-su-xay-dung` (civil)

**vietnamworks.com:**
- Listing pattern: `https://www.vietnamworks.com/viec-lam-{role}-i{categoryId}-vn` or `{role}+tai-{city}-v{cityId}-vn`
- Detail pattern: `https://www.vietnamworks.com/{job-slug}-{id}-jv`
- Confirmed category IDs:
  - `i35` = IT phần mềm (broad — same pollution as vl24h, needs title filter)
  - tech: `i35` + title regex
  - marketing: see taxonomy md §B1 — uses `/marketing` listing endpoint
- Approach: identical to topcv — scrape listing HTML, extract cards

## Implementation Steps

1. **Anti-bot probe (30 min)**:
   - From local: `curl -A "Mozilla/5.0..." https://www.topcv.vn/tim-viec-lam-it-phan-mem | head -100`. If 200 OK with listing markup → proceed. If 403 / Cloudflare → document blocker, defer this phase, exit.
   - Same for vnw `https://www.vietnamworks.com/viec-lam-it-phan-mem-i35-vn`.
   - If both blocked: skip phase, vl24h alone covers all 6 verticals; close with a `Status: BLOCKED` note in this file.

2. **topcv-parser.ts**:
   - Mirror vl24h-parser API surface: `parseListingPage(html): ListingCard[]` where `ListingCard = { title, detailUrl, company?, location? }`.
   - `parseDetailPage(html): JobPostingLd | { title, company, description, ...inline }` — try ld+json first (faster, structured); fallback to readability extract if absent.
   - Same `ldToJobInput`-style helper emitting `VlJobInput` shape with `source: 'topcv'`.

3. **vnw-parser.ts**: same as topcv-parser, different selectors. Probe the live HTML to lock CSS selectors / regex anchors during implementation (no static schema).

4. **scrape-topcv.ts / scrape-vnw.ts**:
   - Same CLI shape as scrape-vl24h.ts (`--dry-run`, `--limit`, `--max-age-days`, `--out`).
   - Bucket loop: for each `(vertical, subDomain)` pair, fetch each slug URL in `sourceSlugs.topcv` (paginated up to N pages until limit hit). Apply `classifyTitle` at listing level on each card title. Detail-fetch only survivors.
   - Honor robots.txt + rate limit (3000 ms between detail fetches — slower than vl24h to be defensive).

5. **Deduplication across sources**:
   - Add `dedupeKey(job): string` = `${normalizeTitle(title)}|${normalizeCompany(company)}|${location}`. When ingesting from multiple sources, prefer (in order): itviec > vl24h > topcv > vnw (itviec gold standard, vnw lowest signal). One-off helper script `scripts/dedupe-cross-source.ts` runs after multi-source ingest, before embedding step.

6. **Smoke run** (each script, dry-run): assert ≥ 30 surviving URLs per vertical from each board. Spot-check 10 titles per vertical for purity.

## Acceptance Criteria

- [ ] topcv-parser.ts + vnw-parser.ts compile and ldToJobInput emits `source: 'topcv'` / `'vnw'` correctly
- [ ] Dry-run scrape-topcv.ts produces ≥ 30 surviving URLs per vertical OR phase closed as BLOCKED with documented anti-bot failure
- [ ] Same for vnw
- [ ] Dedupe helper merges multi-source output without duplicating identical-title-company-location rows
- [ ] Slug coverage assertion in taxonomy.test.ts extended to assert topcv + vnw arrays non-empty for each vertical (if phase ran)

## Risks

- **TopCV anti-bot (Cloudflare).** Medium likelihood. Mitigation: probe early (step 1); skip phase if blocked. Pool depends on vl24h alone — still hits success metrics for tech ≥ 50.
- **vnw category ID changes silently.** Low likelihood, high impact when it happens. Mitigation: weekly slug audit (Phase 5 cron task) catches drift.
- **Cross-source dedup false-merge.** Two real jobs with similar normalized title at the same company. Mitigation: dedupe key includes location; if same too, prefer richer-description record.

## Rollback

Delete the new parser + script files; remove topcv/vnw slug entries from taxonomy.ts. vl24h-only pipeline untouched.

## Next Phase

→ [phase-04-reingest-and-rebuild.md](./phase-04-reingest-and-rebuild.md)
