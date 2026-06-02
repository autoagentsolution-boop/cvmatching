# Code Review — Phase 3 Job Fit UI

**Date:** 2026-06-02
**Reviewer:** code-reviewer agent
**Scope:** 16 new files + 2 modified (job-fit feature, sidebar nav, refined-cv CTA)
**Plan:** `plans/260529-1031-job-fit-study/phase-03-ui-job-fit.md`

---

## Summary

Overall solid implementation. Plan compliance is high — sidebar appended, sessionStorage key/shape match, sliders read-only, no leaked AI/prompt copy, no inline hex, shared components reused throughout, all files comfortably under 200 LOC. Typecheck passes.

Two real bugs found:
- **P1** — Next.js 16 dynamic `params` not awaited (runtime breakage).
- **P1** — list-page CV-length gate (50 chars) diverges from backend (`min(200)`) — invisible user dead-state when CV is 50–199 chars.

Several P2/P3 quality items below.

---

## P1 — Blocking (must fix before merge)

### P1-1. `params` is sync in Next.js 16 — runtime bug
**File:** `cv-ex-refactor/src/app/(app)/job-fit/[jobId]/page.tsx:3-5`

```tsx
export default function Page({ params }: { params: { jobId: string } }) {
  return <JobFitDetailPage jobId={params.jobId} />;
}
```

Next.js 16 (this repo runs `16.2.6`) types `params` as `Promise<{ jobId: string }>` (per `.next/types/validator.ts` → `AppPageConfig` → `params: Promise<ParamMap[Route]>`). Sync access was deprecated in v15 and breaks in v16. The generated `AppPageConfig` type is widened with `& any` so TS doesn't catch it, but at request time Next passes a Promise — `params.jobId` evaluates to `undefined`. Detail page will always render `EmptyStateBackToList` because `jobs.find(j => j.jobId === undefined)` is null.

**Fix:**
```tsx
export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <JobFitDetailPage jobId={jobId} />;
}
```

### P1-2. Frontend CV-length gate (50) diverges from backend min (200)
**File:** `cv-ex-refactor/src/features/job-fit/job-fit-list-page.tsx:38, 45`

```ts
if (!cvText || cvText.trim().length < 50) return;
```

`RecommendBodySchema` requires `cvText: z.string().min(200)` (`cv-ex-refactor/src/lib/schemas/job-recommend-request.ts:11`). A CV of 50–199 chars:
- Passes the frontend `hasCv` gate (`hasCv = true`)
- Triggers `generate()` → backend returns 400 `invalid_input`
- User sees error toast every load, but the error message is generic since the empty-state CTA never appears

Either align the threshold (use 200) or surface a distinct "CV too short" empty state. Recommend bumping to `200` to match backend so users with truncated CV see `EmptyStateNeedCv` instead of a confusing error loop.

---

## P2 — Should fix

### P2-1. Race: auto-fetch on mount may fire before persist rehydration
**File:** `cv-ex-refactor/src/features/job-fit/job-fit-list-page.tsx:29-42`

```ts
const cacheValid = isCacheValid(useJobFit.getState());
useEffect(() => {
  if (cacheValid) return;
  ...
  void generate(cvText);
}, []);
```

`useEffect([])` runs once at mount with `cacheValid` captured from the first render — and on first render the zustand `persist` middleware may not yet have rehydrated from sessionStorage (rehydration runs but state updates are async to React). Result: a fresh `generate()` call kicks off even when a valid cache is in sessionStorage → wasted LLM quota burn.

**Fix:** Either (a) use `useJobFit.persist.hasHydrated()` gate before the effect runs, or (b) check `cacheValid` inside the effect from `useJobFit.getState()` instead of from captured closure.

### P2-2. `status === 'loading'` persisted as 'idle' but `error` is persisted as-is
**File:** `cv-ex-refactor/src/features/job-fit/job-fit-store.ts:105-114`

`partialize` correctly downgrades `loading → idle`, but persists `error: string | null`. If a previous run errored and tab is reopened, `status='idle'` but `error` is still set — list page would not enter error branch (gated on `status === 'error'`), so the error is silently dropped. Either persist `error: null` whenever status is reset, or strip error from partialize.

### P2-3. SessionStorage write may exceed quota — silent loss
**File:** `cv-ex-refactor/src/features/refined-cv/job-fit-cta-section.tsx:22-31`

```ts
try { sessionStorage.setItem(SESSION_KEY, matchedCv); } catch { console.warn(...); }
router.push('/job-fit');
```

If `setItem` throws (private mode, quota), the warn fires but we still navigate. `/job-fit` will read `null` and show "Cần Refined CV trước" — confusing dead-state for a user who just clicked CTA from refined-cv. Per memory rule `feedback_error_surfacing_no_silent_fallback.md`, this is a silent failure user can't recover from. Should surface "Không lưu được dữ liệu phiên — hãy thử lại" before navigating.

### P2-4. `useJobFit()` destructure subscribes whole store
**Files:**
- `cv-ex-refactor/src/features/refined-cv/job-fit-cta-section.tsx:18` — `const { matchedCv } = useAnalysis()`
- `cv-ex-refactor/src/features/job-fit/job-fit-detail-page.tsx:23` — `const { jobs } = useJobFit()`
- `cv-ex-refactor/src/features/job-fit/job-fit-list-page.tsx:30` — `const { jobs, status, error, generate } = useJobFit()`
- `cv-ex-refactor/src/features/job-fit/study-topics-block.tsx:29` — `const { dislikedKeys, dislike, revertDislike } = useJobFit()`

Object-destructure from zustand re-renders on every store mutation, not just the selected fields. Existing repo precedent (e.g. `download-actions.tsx:40` `useAnalysis(s => s.matchedCv)`) uses selectors. Detail page will re-render on every dislike. Use selectors with shallow compare.

### P2-5. `generate()` does not reject when called during `loading`
**File:** `cv-ex-refactor/src/features/job-fit/job-fit-store.ts:65-85`

No early return for `status === 'loading'`. If `handleRetry()` is double-clicked or React StrictMode double-mounts the effect, two parallel `generate` calls fire → two POST `/api/jobs/recommend` → double quota burn. Add `if (get().status === 'loading') return;` at top.

### P2-6. Error/empty fall-through can stack states
**File:** `cv-ex-refactor/src/features/job-fit/job-fit-list-page.tsx:88-107`

After a successful load (`cacheValid=true, jobs>0`), the `success && jobs.length === 0` branch is impossible — but: after an error from a retry, `status='error'`, `cacheValid` may also be true (prior valid jobs not cleared by the failed retry → `isCacheValid` still true since it checks `jobs.length > 0 && status === 'success'`). Wait — `cacheValid` requires `status === 'success'`. So error branch shows. But there's also the `cacheValid && jobs.length > 0` branch (gated on cacheValid which requires success) — fine. Actually OK. Minor: `cacheValid` recomputed from `getState()` snapshot may not match the destructured `jobs`/`status` reactive values within the same render. Use the destructured values to derive cacheValid for consistency.

### P2-7. Detail page topnavTitle leaks job title to entire layout
**File:** `cv-ex-refactor/src/features/job-fit/job-fit-detail-page.tsx:35`

`topnavTitle={match.title}` — fine for a personal app, but if `match.title` is long ("Senior Frontend Engineer, React/TypeScript, Hà Nội") it'll overflow the topnav. Match other detail pages' truncation behaviour (career-path), or use a static "Chi tiết job".

---

## P3 — Nits

### P3-1. `dims[dim] ?? 0` is unreachable
**File:** `cv-ex-refactor/src/features/job-fit/job-score-block.tsx:57`

`dimensionScores` is a strict zod-validated object — all 9 keys exist. The `?? 0` and `Math.round(... * 100) / 100` rounding to 2 decimals on an int is dead code. Simplify to `dims[dim]`.

### P3-2. `Slider` does not declare `aria-readonly` in its prop type
**File:** `cv-ex-refactor/src/features/job-fit/job-score-block.tsx:69`

Passed but not accepted by `SliderProps` (cv-ex-refactor/src/components/ui/slider.tsx). React forwards arbitrary HTML attrs only on elements, not on custom components — this prop is dropped silently. A11y intent (read-only sliders) is fine because `disabled` is set; either drop the unused `aria-readonly` or extend `SliderProps` to accept it and forward to `RadixSlider.Root`.

### P3-3. Inline `style={{ opacity }}` instead of token
**File:** `cv-ex-refactor/src/features/job-fit/study-topics-block.tsx:71`

`style={{ opacity: isDisliked ? 0.45 : 1 }}` — works but mixes Tailwind+inline. Already there's a `transition-opacity` class. Swap for `className={cn('...', isDisliked && 'opacity-50')}`. Not a token violation (no color), but consistency.

### P3-4. `topReasons` / `topTopics` slice is silent truncation
**File:** `cv-ex-refactor/src/features/job-fit/job-card.tsx:25-26`

`slice(0, 3)` quietly drops reasons 4+ on the card. Fine per spec ("3 reasons"), but if backend ever returns 1–2 (zod allows min 1) the UI shows fewer than 3 — no graceful "see more". Acceptable for v0.3.

### P3-5. `TIER_BADGE_VARIANT` duplicated in `topic-chip.tsx` and `study-topics-block.tsx`
**Files:**
- `topic-chip.tsx:9-13`
- `study-topics-block.tsx:12-16`

Same `Record<StudyTopicOut['tier'], 'success'|'warning'|'info'>` defined twice. DRY: hoist to `types.ts` or pick one.

### P3-6. `extractSource` URL parsing — unhandled IDN hosts
**File:** `cv-ex-refactor/src/features/job-fit/job-fit-detail-page.tsx:66-73`

`new URL(sourceUrl).hostname.replace(/^www\./, '')` — fine for typical seeds. If a Vietnamese-domain job ever uses Punycode the host shows as `xn--...`. Edge case, ignore until real data has it.

### P3-7. `DIM_LABELS: Record<string, string>` widens unnecessarily
**File:** `cv-ex-refactor/src/features/job-fit/types.ts:29`

`Record<typeof DIM_ORDER[number], string>` would give exhaustiveness checks. Now adding a key without a label is silently allowed.

### P3-8. `JobFitCtaSection` Card has no clear visual contrast with surrounding refined-cv content
**File:** `cv-ex-refactor/src/features/refined-cv/job-fit-cta-section.tsx:35`

`variant="default"` (implicit) — same surface as other cards. Consider `variant="inverse"` for a CTA hero feel. UX call, not a bug.

---

## Memory-rule violations (treat as P1)

**None found.** Compliance pass:

- **Design tokens / no inline hex:** ✅ grep for `#[0-9a-fA-F]{3,6}|rgb\(|hsl\(` in `features/job-fit/` returned zero matches. All colors via Tailwind token classes (`text-on-surface-variant`, `bg-secondary`, etc.).
- **Shared components:** ✅ `Card`, `Badge`, `Button`, `Slider`, `EmptyState`, `LoadingState`, `ErrorState`, `PageHeader`, `CircularProgress` all reused. No reinvented primitives.
- **No leaked AI/prompt copy:** ✅ grep for `system prompt|LLM|Gemini|OpenAI|Anthropic|API key|tokens` matched only import paths (`@/lib/llm/...`) — code identifiers, not user-facing strings. All Vietnamese copy in `EmptyStateNeedCv`, `EmptyStateBackToList`, `JobScoreBlock`, etc. references "AI" generically ("Điểm do AI đánh giá") — within spec.
- **Sliders read-only on this page:** ✅ `disabled` is set; `onValueChange` is a no-op closure (`() => {}`); no wiring to store. Tooltip "Điểm do AI đánh giá, không chỉnh sửa được trên trang này" present.
- **Error surfacing — no silent 4xx/5xx fallback:** ✅ `fetchRecommendations` throws on any non-2xx; list page surfaces via `<ErrorState>`. `postDislike` correctly distinguishes 404 (silent, expected) from other 4xx/5xx (logged + re-thrown so optimistic update reverts).
- **Vietnamese user-visible strings:** ✅ All copy in Vietnamese except the `<ErrorState>` "Try again" button label (that's from the shared component, not Phase 3 scope).
- **File LOC < 200:** ✅ Largest file is `job-fit-store.ts` at 122 LOC. Average ~63 LOC.

---

## Plan compliance

| Item | Status |
|---|---|
| Sidebar 5th item appended (not reordered) | ✅ |
| Refined-CV CTA writes `refined-cv-text:v1` then navigates | ✅ |
| SessionStorage key `job-fit-matches:v1` w/ shape `{cvHash, jobs, fetchedAt, expiresAt}` | ✅ (+ `quotaRemaining`, `dislikedKeys`, `status`, `error`) |
| Direct-link without sessionStorage → empty state | ⚠️ Logic correct but P1-1 (sync params) means it ALWAYS shows empty state, never resolves |
| Apply button `<a href="/api/r/{jobId}" target="_blank" rel="noopener noreferrer">` | ✅ |
| Dislike POST `{ jobId, topicId, action: 'dislike' }`, optimistic, revert on 4xx (not 404) | ✅ — note backend sees `topicId: topicName` (string), not a stable id — backend schema must accept the topic name as id |
| Quota error UX | ⚠️ Store captures `quotaRemaining` but UI never displays it (Risk row in plan: "Còn lại: 3 lần hôm nay" missing). P2 — not blocking but missed spec line. |

### Plan deviations (acceptable per plan notes)
- D1 — CTA co-located in `features/refined-cv/`: no circular import. ✅
- D2 — Seniority not shown on card: no placeholder/empty separator left behind. ✅

---

## Positive observations

- Clean separation of concerns: orchestrator pages / blocks / atoms.
- `api-client.ts` correctly handles the 404 silent-fallback exception per memory rule, with explicit `console.debug` for traceability.
- `dislike` optimistic UI with pending-set double-tap guard is correct.
- All files use `'use client'` only where needed (the two glue pages stay RSC).
- A11y: aria-labels on every interactive element, `aria-hidden` on decorative icons, focus-visible rings consistent.
- Topic chip footer card has `target="_blank" rel="noopener noreferrer"` everywhere (tab-nabbing safe).
- Error normalization shared with other features via `humanize-error.ts` — consistent UX.

---

## Recommended actions (priority order)

1. **P1-1** — Convert detail page to `async` + `await params` (Next 16).
2. **P1-2** — Bump list-page CV gate to 200 chars to match backend.
3. **P2-1** — Gate auto-fetch on `useJobFit.persist.hasHydrated()`.
4. **P2-3** — Surface sessionStorage write failure on CTA click.
5. **P2-5** — Reject concurrent `generate()` calls.
6. **P2-2** — Clear persisted `error` when status is downgraded to `idle`.
7. **P2-4** — Switch to zustand selectors (consistency w/ existing pattern).
8. Display `quotaRemaining` in UI (CTA banner or list-page status).
9. P3 nits.

---

## Metrics
- Files reviewed: 16 new + 2 modified
- LOC total (new): 942
- Largest file: `job-fit-store.ts` (122)
- All under 200 ✅
- Typecheck: passes (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, strict)
- Inline hex / rgb / hsl matches: 0
- Leaked AI/prompt strings in user copy: 0

## Unresolved questions
- Should backend `postDislike` accept `topicId` as a *name* string or a stable id? Phase 4 contract clarification needed.
- Plan risk row asks for "Còn lại: 3 lần hôm nay" quota indicator on CTA — was this dropped intentionally or missed? Recommend confirming with PM before merge.

---

**Status:** APPROVE_WITH_FIXES
**Summary:** Solid plan-compliant implementation with two P1 bugs (sync `params` in Next 16, frontend/backend CV-length mismatch) and several P2 race/error-handling smells. Memory rules all clean. Fix P1s before merge; P2s in a follow-up PR if scope-tight.
**Concerns/Blockers:** P1-1 will break the detail page entirely at runtime. P1-2 produces a confusing user dead-state for short CVs.
