# Phase 2 — Tier Badge UI + Red Flag Surface

**Day:** Thu 2026-06-04 | **Effort:** 4-6h | **Status:** Complete (pulled forward to Wed)

## Done

- `src/features/analyze/red-flags-section.tsx` — Card section, amber left-border, renders null when empty
- `src/features/refined-cv/red-flags-banner.tsx` — collapsible amber banner with expand/collapse, renders null when empty
- `src/features/job-fit/job-card.tsx` — `<TierBadge>` top-left + extended score variant scale (sub-60 → error)
- `src/features/job-fit/job-fit-detail-page.tsx` — `<TierBadge>` inline with title in PageHeader
- `src/features/job-fit/job-fit-list-page.tsx` — `groupByTier()` renders S→E sections with icon + count; underfill footer when `< TARGET_JOBS (10)`
- `src/features/results/results-section.tsx` — `<RedFlagsSection>` rendered after Tabs when `result.redFlags.length > 0`
- `src/features/refined-cv/refined-cv-view.tsx` — `<RedFlagsBanner>` above the markdown card (read from `useAnalysis().result`)
- `TierBadgeProps.reason` typed `string | undefined` to satisfy `exactOptionalPropertyTypes` callers
- `npx tsc --noEmit` clean

## Goal

Wire `<TierBadge>` into job-fit list + detail. Surface red flags on both `/analyze` results and `/refined-cv` banner.

## Files

**Create:**
- `cv-ex-refactor/src/features/analyze/red-flags-section.tsx` — section component for analyze results
- `cv-ex-refactor/src/features/refined-cv/red-flags-banner.tsx` — banner component with expand

**Modify:**
- `cv-ex-refactor/src/features/job-fit/job-card.tsx` — render `<TierBadge>` top-left of card
- `cv-ex-refactor/src/features/job-fit/job-fit-list-page.tsx` — group jobs visually by tier (S → E) or just sort; show "Chỉ N jobs match. Thêm jobs ngày mai." footer when < 10
- `cv-ex-refactor/src/features/job-fit/job-fit-detail-page.tsx` — render `<TierBadge>` in header
- `cv-ex-refactor/src/features/job-fit/types.ts` — add `tier: TierLetter` to `JobMatchView`
- `cv-ex-refactor/src/features/analyze/<results-page>.tsx` — embed `<RedFlagsSection>` after analysis parameters
- `cv-ex-refactor/src/features/refined-cv/refined-cv-page.tsx` — embed `<RedFlagsBanner>` at top

## Spec — red-flags-section.tsx

```tsx
type Props = {
  redFlags: Array<{ flag: string; concern: string }>;
};
// Header: "🚩 Cẩn trọng — N điểm cần xem lại"
// List: each row = flag (bold) + concern (muted text)
// Empty state: don't render (return null)
```

## Spec — red-flags-banner.tsx

```tsx
type Props = {
  redFlags: Array<{ flag: string; concern: string }>;
};
// Banner: amber/warning color
// "⚠️ CV gốc có N điểm cần xem lại trước khi refine. [Xem chi tiết ↓]"
// Expand: render full list inline like red-flags-section
// Empty state: don't render
```

## Implementation steps

1. **TierBadge wire (job-fit):**
   - Open `job-card.tsx`, find the title/score row, add `<TierBadge tier={job.tier} />` top-left
   - Open `job-fit-list-page.tsx`, optionally group cards by tier with section headers `"🚀 S — Strong Apply"`, etc.
   - Show footer "Chỉ {N}/10 jobs match. Thêm jobs ngày mai." when results.length < 10
   - Open `job-fit-detail-page.tsx`, add badge to header
2. **Red flag section (`/analyze`):**
   - Find where analyze results render (likely `features/analyze/<results-component>.tsx` — scan for `redFlags` use)
   - Insert `<RedFlagsSection redFlags={analysis.redFlags} />` after parameters block
3. **Red flag banner (`/refined-cv`):**
   - Open `refined-cv-page.tsx`, find top of content area
   - Insert `<RedFlagsBanner redFlags={analysis.redFlags} />` (analysis context shared via store)
4. **Test:**
   - Submit analyze with CV containing fake claims → verify red flags section shows
   - Navigate to /refined-cv → verify banner shows + expand works
   - Submit recommend → verify each card shows tier badge + group/sort works

## Acceptance

- Typecheck + lint clean
- Visual smoke: tier letter visible on each job card (color per tier)
- Red flag section/banner visible when data present, hidden when empty
- Underfill footer shown when < 10 jobs

## Risks

- Red flag data shape mismatch — `Array<{flag, concern}>` confirmed in types.ts:104. Safe.
- Job-fit store may not carry tier yet — pass through from API response, propagate in `api-client.ts`
- Banner color conflict with new ui-polish tokens — use semantic Tailwind class (e.g., `bg-amber-50 text-amber-900`), ui-polish later replaces with token-driven

## Next

Phase 3 — action column wiring per tier.
