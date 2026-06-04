# Phase 4 — Company Card UI (Tier 1 + Ratings, Instant Render)

**Effort:** 2-3h
**Owner:** lead
**Status:** pending
**Blocked by:** phases 1, 2, 3
**Blocks:** phase 6

## Goal

Render company card on Job Fit detail page with Tier 1 facts (logo, name, industry, size, location, website) + external rating badges, both instant-render via SSR. Right rail card desktop, collapsible block above match-reasons on mobile. Suspense boundary reserved for Phase 6 (Tier 2 LLM enrichment) — slot present but empty in this phase.

## Files to Create

- `src/features/job-fit/company-card.tsx` — main component, ≤ 180 lines (split into `company-card-header.tsx` + `company-card-facts.tsx` + `company-card-ratings.tsx` if exceeded)
- `src/features/job-fit/company-card.test.tsx` — RTL render states (full / Tier 1 only / ratings only / empty)
- `src/features/job-fit/company-card-empty.tsx` — empty-state component for SMEs with no data

## Files to Modify

- `src/features/job-fit/job-fit-detail-page.tsx` — insert `<CompanyCard companyId={job.companyId} />` in layout. Desktop right rail, mobile collapsible above match-reasons-block.
- `src/app/(app)/job-fit/[jobId]/page.tsx` — SSR-fetch company by `job.companyId` alongside job; pass as prop to detail page. Use `Promise.all` with existing job fetch.

## Layout Spec

**Desktop (≥ lg breakpoint):**
- 2-column layout: left = score + reasons + topics (existing), right = sticky sidebar with CompanyCard at top + Apply CTA below
- Card width: ~320px

**Mobile (< lg):**
- Single column, CompanyCard renders between job-title block and match-reasons-block
- `<details>` collapsible, default open if Tier 1 present, default collapsed if only stub

## Render States

| State | Trigger | UI |
|---|---|---|
| Full | Tier 1 present + ratings present | Logo + name + industry/size/location chips + website link + Glassdoor badge + Google badge |
| Tier 1 only | Tier 1 present, ratings null | Same minus rating badges, no placeholder |
| Stub | `tier1Pending: true` | Logo placeholder + name + "Đang cập nhật thông tin công ty" |
| No company | `job.companyId` missing | Card hidden entirely (legacy 150 jobs without companyId) |
| Empty SME | Tier 1 fields all undefined despite scrape success | `CompanyCardEmpty` — name only + small note "Công ty chưa có thông tin chi tiết công khai" |

## Component Sketch

```tsx
// src/features/job-fit/company-card.tsx
import { tokens } from '@/lib/design/tokens';
import { Card, Chip, IconExternal } from '@/components/ui';  // existing shared

export function CompanyCard({ company, ratings }: Props) {
  if (!company) return null;
  if (company.tier1Pending) return <CompanyCardStub name={company.canonicalName} />;
  if (isAllTier1Empty(company)) return <CompanyCardEmpty name={company.canonicalName} />;

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <CompanyLogo src={company.logoUrl} fallback={company.canonicalName} />
        <h3>{company.canonicalName}</h3>
      </header>

      <div className={styles.facts}>
        {company.industry && <Chip label={company.industry} />}
        {company.sizeRange && <Chip label={`${company.sizeRange} nhân viên`} />}
        {company.hqLocation && <Chip label={company.hqLocation} icon="location" />}
      </div>

      {company.website && (
        <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className={styles.website}>
          {prettyDomain(company.website)} <IconExternal size={14} />
        </a>
      )}

      <RatingBadges ratings={ratings} />

      {/* Phase 6 mounts here */}
      <Suspense fallback={<EnrichmentSkeleton />}>
        <CompanyCardEnrichment companyId={company.id} />
      </Suspense>
    </Card>
  );
}
```

## Rating Badges

```tsx
function RatingBadges({ ratings }: { ratings?: ExternalRatings }) {
  if (!ratings) return null;
  return (
    <div className={styles.ratings}>
      {ratings.glassdoor && (
        <a href={ratings.glassdoor.url} target="_blank" rel="noopener noreferrer nofollow"
           className={styles.ratingBadge} aria-label={`Glassdoor: ${ratings.glassdoor.score}/5 từ ${ratings.glassdoor.count} đánh giá`}>
          <span className={styles.platform}>Glassdoor</span>
          <span className={styles.score}>★ {ratings.glassdoor.score.toFixed(1)}</span>
          <span className={styles.count}>({ratings.glassdoor.count})</span>
        </a>
      )}
      {ratings.google && (
        <a href={ratings.google.url} target="_blank" rel="noopener noreferrer nofollow"
           className={styles.ratingBadge}>
          <span className={styles.platform}>Google</span>
          <span className={styles.score}>★ {ratings.google.score.toFixed(1)}</span>
          <span className={styles.count}>({ratings.google.count})</span>
        </a>
      )}
    </div>
  );
}
```

## SSR Data Fetch

```ts
// src/app/(app)/job-fit/[jobId]/page.tsx
const [job, company, ratings] = await Promise.all([
  fetchJob(jobId),
  job?.companyId ? fetchCompany(job.companyId) : null,
  job?.companyId ? fetchRatings(job.companyId) : null,
]);
```

Both `fetchCompany` + `fetchRatings` are direct KV reads — no network round-trip. Adds ~5-10ms to SSR.

## Implementation Steps

1. Create `company-card.tsx` skeleton per sketch. Use existing tokens + shared components per memory [[feedback_ui_ux_design_system]] — no custom CSS values, no leaked AI/prompt text.
2. Implement render-state branches: stub, empty, full. Add `isAllTier1Empty(company)` helper.
3. Implement `RatingBadges` sub-component. Single inline file or split if > 50 lines.
4. Update SSR data fetch in `[jobId]/page.tsx` to parallel-load company + ratings.
5. Update `job-fit-detail-page.tsx` layout: desktop 2-column with sticky sidebar, mobile `<details>` collapsible.
6. Suspense boundary reserved for `<CompanyCardEnrichment />` — placeholder component returning `null` in this phase (Phase 6 implements). Skeleton renders during loading.
7. RTL tests: render fixtures for each state (full / Tier 1 only / stub / empty / no company), snapshot.
8. Visual: open in dev server, verify desktop + mobile layouts. Screenshot to `Screenshot/company-card-{state}.png` for review.

## Acceptance Criteria

- [ ] Card renders on Job Fit detail when `job.companyId` present
- [ ] All 5 render states proven via RTL snapshot
- [ ] No console errors on image load failure (logo fallback works)
- [ ] All external links have `rel="noopener noreferrer nofollow"` (lint asserts)
- [ ] Mobile collapsible respects user preference (default open if Tier 1 present)
- [ ] Existing Job Fit detail layout not broken (regression test)
- [ ] Uses tokens + shared components per [[feedback_ui_ux_design_system]]
- [ ] No untranslated English strings, no "[placeholder]" text leakage
- [ ] `pnpm tsc --noEmit` clean

## Risks

- **Logo CDN hotlink 403**: source CDN may block. Mitigation: `onError` handler on `<img>` → fallback to initials avatar (existing `CompanyLogo` component or new util). Self-host deferred to Phase 8.
- **Layout shift**: rating badges load conditionally; if their height varies on render → CLS regression. Mitigation: reserve min-height on `RatingBadges` wrapper (~32px); test with PageSpeed Insights or local Lighthouse on detail page.
- **Sticky sidebar overflow on short viewport**: card + Apply CTA may exceed viewport height. Mitigation: scrollable sidebar with `overflow-y: auto` + max-height.

## Security

- All external links escaped via existing URL sanitizer (no `javascript:` injection)
- Logo `<img src>` from KV — validate URL is `https://` only in render-time guard
- No user input rendered raw — all text is from KV (admin-curated via Phase 7 if needed)
- Rating badges link to glassdoor.com / google.com — known hosts

## Team Impact

- Visual sign-off needed from user (per memory: pre-finalization rules in [[feedback_ui_ux_design_system]])
- Update `docs/system-architecture.md` UI section with company card placement

## Next Phase

→ phase-05-llm-enrichment.md (parallel; this phase + Phase 5 both feed Phase 6)
