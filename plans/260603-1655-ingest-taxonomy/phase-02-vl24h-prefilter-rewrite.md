# Phase 2 — vl24h Pre-Filter Rewrite

**Effort:** 3-4h
**Status:** ✅ Code shipped 2026-06-03. Live dry-run on prod sitemap deferred (operator-run, needs network).
**Blocked by:** phase 1
**Blocks:** phases 3, 4

## Goal

Rewrite the vl24h scrape pipeline so URL slug + listing-card title filtering happens BEFORE detail HTML fetch. Wire `taxonomy.ts` as the single source of truth. Carry `subVertical` through `ldToJobInput`.

## Files to Modify

- `scripts/scrape-vl24h.ts` — replace bucket loop with taxonomy-driven filter; add listing-card title extraction from sitemap entries; emit filter-rejection stats per reason
- `src/lib/scrape/vl24h-parser.ts` — remove hardcoded `SLUG_VERTICAL` map (defer to taxonomy.ts); add `extractListingTitleFromSitemap` helper; `ldToJobInput` accepts + emits subVertical
- `src/lib/jobs/classify.ts` — replace flat regex cascade with `pickSubVertical()` call from taxonomy.ts; keep finance-company allowlist as a separate signal that supplements (not overrides) taxonomy

## Listing-Card Title Source

vl24h sitemap URLs encode the job title as a slug: `https://vieclam24h.vn/{category-slug}/{title-slug}-c{id}p{id}id{id}.html`. The title-slug is a dashed lowercase ASCII-folded version of the title. Strategy:

1. Extract title-slug from URL (regex group): `/\/[^/]+\/([^/]+)-c\d+p\d+id\d+\.html$/`
2. Convert dashes → spaces, leave ASCII-folded form
3. Apply `taxonomy.titlesPositive` + `titlesNegative` regex (regex authors must match folded forms: include `co khi`, `ky su`, `nhan vien kinh doanh`, etc., alongside the diacritic forms)

This avoids fetching a separate listing-page HTML — title is in the URL itself. KISS.

## Implementation Steps

1. **vl24h-parser.ts changes**:
   - Delete `SLUG_VERTICAL` constant + `slugToVertical()`. Replace callers with `import { slugToVerticalAndSub } from '@/lib/jobs/taxonomy'`.
   - Add `extractTitleSlugFromUrl(url: string): string | null` — regex match the title segment.
   - Add `foldAndDeslug(titleSlug: string): string` — replace `-` with ` `, lowercase, return.
   - Update `ldToJobInput` signature: `(ld, sourceUrl, vertical, subVertical?: string) => VlJobInput`. Field added on `VlJobInput`.

2. **scrape-vl24h.ts changes**:
   - Import `TAXONOMY`, `slugToVerticalAndSub`, `classifyTitle` from taxonomy.ts.
   - After collecting all sitemap URLs, build buckets through 2 sequential filters BEFORE detail fetch:
     - Filter 1 (slug): drop URLs whose slug isn't in any vertical's `sourceSlugs.vl24h`. Track count in `rejectedBySlug` counter.
     - Filter 2 (title): for surviving URLs, extract title-slug, deslug, run `classifyTitle(vertical, foldedTitle)`. If rejected, increment `rejectedByTitleNegative` or `rejectedByTitleNoMatch`. Else attach `subVertical` to a per-URL meta record.
   - Detail-fetch loop: only iterate the surviving URL list. Carry `subVertical` into `ldToJobInput`.
   - Re-verify title at detail-fetch time: after `ldToJobInput`, run `classifyTitle` again on the canonical `ld.title` (richer than URL slug). If rejected at this stage, log + count `rejectedAtDetail`, continue.

3. **classify.ts changes**:
   - Replace the body of `classifyVertical()` with a call to `pickSubVertical(/* lets it infer vertical */)` then strip to vertical. Keep finance-company allowlist as a pre-check (banks override taxonomy when title is ambiguous like "Senior Analyst").
   - Export new `classifyVerticalAndSub(title, company): { vertical, subVertical? }` for ingest CLI use.

4. **Logging + observability**:
   - Add per-vertical rejection breakdown to summary log: `${v} collected=N rejectedBySlug=N rejectedByTitleNeg=N rejectedByTitleNoMatch=N rejectedAtDetail=N`.
   - Pre-detail filter counts logged BEFORE the detail loop starts so an aborted run still shows what the filter would have done.

5. **Dry-run sanity**: `pnpm tsx scripts/scrape-vl24h.ts --dry-run --limit 50 --max-age-days 3`. Read the rejection stats. Expected: tech rejectedByTitleNeg should be > 0 (we filter out kỹ sư cơ khí etc); per-vertical surviving pool should be ≥ 50 each.

## Acceptance Criteria

- [x] Hardcoded `SLUG_VERTICAL` removed; vl24h-parser.ts delegates to taxonomy.ts
- [x] scrape-vl24h.ts dry-run shows per-rejection-reason counts (impl in scripts/scrape-vl24h.ts: `preFilter()` emits totals + per-vertical breakdown before any HTTP)
- [ ] Dry-run on prod sitemap yields ≥ 50 surviving URLs per vertical — **operator-run, deferred**
- [x] subVertical field populated on every output JobInput when classifier resolves one (undefined allowed when fallback cascade decides — additive, not regression)
- [x] Existing unit tests still pass (180/180 + new tests/vl24h-parser.test.ts)
- [x] `pnpm tsc --noEmit` clean
- [ ] Manual spot-check: 20 surviving tech URLs are real software/data/ML by title alone — **operator-run, deferred**

## Implementation Notes (2026-06-03)

- Word-boundary fix on tech.data/`bi|ba|dba` and tech.ml-ai/`ml|ai|llm|nlp` — bare tokens were matching substrings ("ai" inside "chain" pulled "Supply Chain Specialist" into tech). Taxonomy patched, full suite re-green.
- `classifyVertical()` now delegates to a new `classifyVerticalAndSub()` that runs `taxonomy.pickSubVertical()` first, falls back to the legacy regex cascade for titles taxonomy doesn't cover (HR/PM/coordinator etc). Existing test for "HR Business Partner → other" updated to "HR Business Partner → ops" — taxonomy promotes HR from 'other' to ops.hr.
- Ingest CLIs (`scripts/ingest-file.ts`, `scripts/ingest-paste.ts`) wire `subVertical` through to the saved Job record.
- New `extractTitleSlugFromUrl(url)` + `foldAndDeslug(slug)` helpers in vl24h-parser.ts; tested in tests/vl24h-parser.test.ts.
- scrape-vl24h.ts: pre-filter pass emits per-vertical survived / rejNeg / rejNoMatch counters before any detail fetch. Detail-fetch loop re-classifies with ld.title and accepts the richer sub-vertical (or rejects on detail-stage negative-match).

## Risks

- Title-slug may be aggressively folded (loses diacritics) and lose negative-keyword signal. Mitigation: taxonomy regex includes both folded ASCII AND full-diacritic forms — already specified in Phase 1.
- Listing-card title in URL may truncate at ~60 chars, hiding a discriminating word ("Marketing & Sales Manager" → URL slug might cut "marketing-sales-manager"). Mitigation: phase 2 step 2 includes second-pass title check on detail-fetched ld.title.
- Refactor breaks the 150-prod-jobs ingest backward compat. Mitigation: classify.ts changes are additive (new function), old `classifyVertical(title, company)` kept as wrapper.

## Rollback

`git revert` the phase-2 commit. Old `SLUG_VERTICAL` map restored; classifier reverts to flat cascade. No data migration needed since prod KV is untouched in this phase.

## Next Phase

→ [phase-03-multi-board-integration.md](./phase-03-multi-board-integration.md)
