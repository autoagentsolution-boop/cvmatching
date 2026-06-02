# Phase 03 — UI: `/job-fit` List + `/job-fit/[jobId]` Detail + Sidebar Nav + Refined-CV CTA

## Context Links
- Spec: `plans/reports/spec-260529-1031-job-fit-study.md` (User journey)
- Memory: `feedback_ui_ux_design_system.md` — mandatory tokens/shared components/layout templates; no leaked AI/prompt text
- Memory: `feedback_scoring_ux_model.md` — 9-dim sliders are LLM scores (read-only here per spec, no user override on this page)
- Sidebar: `cv-ex-refactor/src/components/layouts/dashboard-sidebar.tsx`
- Refined CV page: `cv-ex-refactor/src/app/(app)/refined-cv/page.tsx` + `src/features/refined-cv/refined-cv-page.tsx`
- Career-path feature layout reference: `cv-ex-refactor/src/features/career-path/*`
- Design tokens: `cv-ex-refactor/src/lib/design-tokens.ts` + `src/app/globals.css` @theme

## Overview
- **Priority:** P1 — user-facing
- **Status:** pending
- **Description:** Two pages + 3 reusable components + sidebar nav add + refined-cv CTA. State stored in sessionStorage only (no auth, no DB). Detail page is shareable by URL (jobId hash).

## Key Insights
- Sidebar currently has 4 nav items; **append** `Job Fit & Study` as the 5th (after `Career Path`) — do not reorder.
- `refined-cv` page is the trigger — CTA appears under the polished CV preview. Wording: "Tìm 10 job phù hợp + chủ đề ôn luyện →".
- 9-dim sliders are READ-ONLY here (spec: "full 9-dim scores (read-only sliders)"). User cannot override on this page. (Differs from refined-cv flow.)
- Detail page URL `/job-fit/[jobId]` must be shareable → state on detail page falls back to refetching by `jobId` if sessionStorage empty; this means we either store the full match payload server-side (NO — KV-only design forbids per-user state) or accept that direct-link visits show a "Generate from your CV first" empty state.
- Decision: **Direct-link visits without sessionStorage show empty state with CTA back to `/job-fit`**. URL is shareable as anchor, not as standalone state.
- "Apply" button uses `/api/r/[jobId]` redirect (Phase 4 ships the route; Phase 3 UI just links to the URL).
- "Cập nhật: X ngày trước" badge computed from `verifiedAt` field on Job.
- Dislike button on each studyTopic → POST `/api/topics/feedback` (Phase 4 ships route; Phase 3 wires the call with graceful 404 fallback if not yet deployed).

## Requirements

### Functional
- F1. New nav item `Job Fit & Study` in sidebar (5th position, `icon: 'work'`, href: `/job-fit`).
- F2. CTA button on `/refined-cv`: "Tìm 10 job phù hợp + chủ đề ôn luyện →" → navigates to `/job-fit`.
- F3. `/job-fit` page:
   - Empty state when `cvText` missing from sessionStorage → "Paste your refined CV first" with link to `/refined-cv`.
   - Loading state during fetch.
   - Error state with retry.
   - Job card list (5-10): title @ company · seniority · location · overallScore badge · 3 matchReasons · top 3 studyTopics inline · "Xem chi tiết →" link.
- F4. `/job-fit/[jobId]` page:
   - Reads match from sessionStorage by jobId; if not found → empty state CTA back.
   - Full 9-dim score sliders (read-only).
   - Full matchReasons (3-5).
   - Full studyTopics list (5-10): name · tier badge · estimatedHours · whyForThisJob · dislike button.
   - "Cập nhật: X ngày trước" badge.
   - "Apply trên {source} →" link to `/api/r/[jobId]`.
   - "Quay lại danh sách" link.
- F5. Dislike button: POST `/api/topics/feedback` with `{ jobId, topicId, action: 'dislike' }`. Optimistic UI: chip dims immediately; revert on 4xx.
- F6. SessionStorage shape: `jobFitMatches = { cvHash: string; jobs: JobMatch[]; fetchedAt: ISOString; expiresAt: ISOString }`.

### Non-functional
- All design tokens; no inline color hex (per UI memory rule).
- Reuse existing shared components: `Card`, `Badge`, `Button`, `Slider` (read-only mode), `EmptyState`, `LoadingState`, `ErrorState`, `PageHeader`.
- No leaked prompt text or AI references in UI (per memory rule).
- Pages < 200 LOC each (project rule); split into feature blocks like career-path.
- Match the visual feel of `career-path` page (same `DashboardLayout`, `PageHeader`, card stack).
- Vietnamese copy for user-visible strings.

## Architecture

### Page composition

```
/job-fit (page.tsx)
  └─ <DashboardLayout activeNav="job-fit">
       └─ <JobFitListPage />   (features/job-fit/job-fit-list-page.tsx)
            ├─ <PageHeader title="Job Fit & Study" subtitle="..." />
            ├─ if empty → <EmptyStateNeedCv />
            ├─ if loading → <LoadingState />
            ├─ if error → <ErrorState onRetry />
            └─ if loaded:
                 └─ <JobCardGrid jobs={state.jobs}>
                      └─ <JobCard match={m} /> × N
                           └─ <TopicChip /> × 3

/job-fit/[jobId] (page.tsx)
  └─ <DashboardLayout activeNav="job-fit">
       └─ <JobFitDetailPage jobId={params.jobId} />
            ├─ if no sessionStorage → <EmptyStateBackToList />
            └─ if loaded:
                 ├─ <PageHeader title={match.title} subtitle={`${company} · ${seniority}`} />
                 ├─ <JobScoreBlock dims={match.dimensionScores} overall={match.overallScore} />
                 ├─ <MatchReasonsBlock reasons={match.matchReasons} />
                 ├─ <StudyTopicsBlock topics={match.studyTopics} onDislike={...} />
                 └─ <DetailActionsBar source={match.source} jobId={match.jobId} />
```

### State (sessionStorage)

```ts
type JobFitState = {
  cvHash: string;            // sha-256 first 16 chars; lets us detect CV change
  jobs: JobMatch[];          // enriched: title/company/location/source from server
  fetchedAt: string;         // ISO
  expiresAt: string;         // ISO; backend returned this
};

// Store key: 'job-fit-matches:v1'
// Hydration on page load:
//   1. Read sessionStorage
//   2. If absent or expired → empty state w/ "Generate" button (anon: 5/day; user: 12/day)
//   3. "Generate" → POST /api/jobs/recommend → write sessionStorage → re-render
```

### API client

```
features/job-fit/api-client.ts
  fetchRecommendations(cvText: string): Promise<RecommendResponse>
  postDislike(jobId: string, topicId: string): Promise<void>  // fire-and-forget; logs on error
```

## Related Code Files

### New
- `cv-ex-refactor/src/app/(app)/job-fit/page.tsx` (<20 LOC, glue)
- `cv-ex-refactor/src/app/(app)/job-fit/[jobId]/page.tsx` (<20 LOC, glue)
- `cv-ex-refactor/src/features/job-fit/job-fit-list-page.tsx` (<200 LOC, orchestrates list view)
- `cv-ex-refactor/src/features/job-fit/job-fit-detail-page.tsx` (<200 LOC, orchestrates detail view)
- `cv-ex-refactor/src/features/job-fit/job-fit-store.ts` (<150 LOC, zustand or plain hook over sessionStorage; reuse pattern from career-path-store)
- `cv-ex-refactor/src/features/job-fit/api-client.ts` (<100 LOC, fetch wrappers)
- `cv-ex-refactor/src/features/job-fit/types.ts` (<80 LOC, re-export `JobMatch` + UI-only types)
- `cv-ex-refactor/src/features/job-fit/job-card.tsx` (<200 LOC, single card; spec calls it `components/job-card.tsx` but we co-locate)
- `cv-ex-refactor/src/features/job-fit/job-score-block.tsx` (<150 LOC, 9-dim read-only sliders + overall)
- `cv-ex-refactor/src/features/job-fit/match-reasons-block.tsx` (<100 LOC)
- `cv-ex-refactor/src/features/job-fit/study-topics-block.tsx` (<200 LOC, list + dislike)
- `cv-ex-refactor/src/features/job-fit/topic-chip.tsx` (<100 LOC, name + tier badge + dislike button)
- `cv-ex-refactor/src/features/job-fit/detail-actions-bar.tsx` (<100 LOC, Apply + Back buttons)
- `cv-ex-refactor/src/features/job-fit/empty-state-need-cv.tsx` (<80 LOC)
- `cv-ex-refactor/src/features/job-fit/empty-state-back-to-list.tsx` (<80 LOC)

### Modified
- `cv-ex-refactor/src/components/layouts/dashboard-sidebar.tsx` — extend `ActiveNav` union with `'job-fit'`; append nav item `{ key: 'job-fit', label: 'Job Fit & Study', icon: 'work', href: '/job-fit' }`.
- `cv-ex-refactor/src/features/refined-cv/refined-cv-page.tsx` — append CTA section under polished CV preview: button "Tìm 10 job phù hợp + chủ đề ôn luyện →" navigates to `/job-fit`. Wire `useAnalysis.cvText` → write to sessionStorage `refined-cv-text:v1` so `/job-fit` can read.

### Notes
- Spec lists `components/job-card.tsx` etc.; we **co-locate** under `features/job-fit/` to mirror `features/career-path/` pattern. This is a structural consistency call. Document deviation in plan.md (already implicit).

## Implementation Steps

1. **Types.** Create `features/job-fit/types.ts`. Re-export `JobMatch`, `StudyTopic`, `Job` from `lib/jobs/types.ts`. Add UI-only `EnrichedJobMatch = JobMatch & { title; company; location; seniority; source; verifiedAt }`.
2. **Store.** Create `features/job-fit/job-fit-store.ts`. Reuse career-path-store pattern (`zustand` with sessionStorage persistence). State: `cvText, cvHash, jobs, fetchedAt, expiresAt, status: 'idle'|'loading'|'success'|'error', error`. Actions: `generate(cvText)`, `dislike(jobId, topicId)`, `clear()`.
3. **API client.** Create `features/job-fit/api-client.ts`:
   - `fetchRecommendations(cvText: string)` → POST `/api/jobs/recommend`, body validate response shape.
   - `postDislike(jobId, topicId)` → POST `/api/topics/feedback` with `{ jobId, topicId, action: 'dislike' }`.
   - Error normalization: re-throw `{ code, message }` per backend error shape.
4. **Sidebar nav.** Modify `dashboard-sidebar.tsx`:
   - Widen `ActiveNav` to include `'job-fit'`.
   - Append `{ key: 'job-fit', label: 'Job Fit & Study', icon: 'work', href: '/job-fit' }`.
5. **Refined-CV CTA.** Modify `features/refined-cv/refined-cv-page.tsx`:
   - After existing render, append `<JobFitCtaSection cvText={state.refinedCvText} />` (or inline a card with `Button` linking to `/job-fit`).
   - On click: write `sessionStorage['refined-cv-text:v1'] = cvText` then `router.push('/job-fit')`.
6. **List page glue.** Create `app/(app)/job-fit/page.tsx`:
   ```tsx
   import { JobFitListPage } from '@/features/job-fit/job-fit-list-page';
   export default function Page() { return <JobFitListPage />; }
   ```
   Mark page with `'use client'`-wrapping inside the feature component (per existing pattern).
7. **Detail page glue.** Create `app/(app)/job-fit/[jobId]/page.tsx`:
   ```tsx
   import { JobFitDetailPage } from '@/features/job-fit/job-fit-detail-page';
   export default function Page({ params }: { params: { jobId: string } }) {
     return <JobFitDetailPage jobId={params.jobId} />;
   }
   ```
8. **List page component.** `job-fit-list-page.tsx`:
   - On mount: read `sessionStorage['refined-cv-text:v1']` and `sessionStorage['job-fit-matches:v1']`.
   - If matches exist and not expired → render list.
   - If cvText present but no matches → call `store.generate(cvText)` on mount.
   - If neither → render `<EmptyStateNeedCv />`.
   - During fetch → `<LoadingState />`.
   - Error → `<ErrorState onRetry={retry} message={humanized}/>`.
   - Loaded → grid of `<JobCard />`.
9. **Job card.** `job-card.tsx`:
   - Card with header (title, company, location, seniority chip, overall score badge).
   - Body: 3 matchReasons bullets.
   - Footer: top 3 studyTopics as `<TopicChip />`.
   - Link: "Xem chi tiết →" → `/job-fit/[jobId]`.
10. **Detail page component.** `job-fit-detail-page.tsx`:
    - On mount: read sessionStorage; find by jobId.
    - If absent → `<EmptyStateBackToList />`.
    - Loaded → render `JobScoreBlock`, `MatchReasonsBlock`, `StudyTopicsBlock`, `DetailActionsBar`.
11. **Score block.** `job-score-block.tsx`:
    - Overall score circle (CircularProgress).
    - 9 horizontal sliders (existing `Slider` in read-only mode — `disabled`).
    - Dimension labels in Vietnamese.
12. **Study topics block.** `study-topics-block.tsx`:
    - Iterate topics. For each render: name, tier badge ("Cơ bản"/"Trung cấp"/"Nâng cao"), estimatedHours, whyForThisJob paragraph, dislike icon button.
    - Optimistic dislike: dim chip + call `store.dislike(jobId, topicId)`. On error: revert + toast.
13. **Actions bar.** `detail-actions-bar.tsx`:
    - "Apply trên {source} →" → `<a href={"/api/r/" + jobId} target="_blank" rel="noopener noreferrer" />`.
    - "Quay lại danh sách" → `Link` to `/job-fit`.
14. **Empty states.** Two components per spec — needCv (CTA "Tạo refined CV trước") and backToList (CTA "Xem danh sách jobs").
15. **A11y pass.** All interactive elements have `aria-label`; sliders have `aria-readonly="true"`; dislike button `aria-label="Không thích chủ đề này"`.
16. **Compile + visual check.** `npm run build`. Run dev server, visit `/refined-cv`, click CTA, verify list renders, click a card, verify detail.

## Todo List
- [ ] H3.1 `features/job-fit/types.ts`
- [ ] H3.2 `features/job-fit/job-fit-store.ts` (sessionStorage)
- [ ] H3.3 `features/job-fit/api-client.ts`
- [ ] H3.4 Sidebar nav extended with `job-fit`
- [ ] H3.5 Refined-CV page CTA appended
- [ ] H3.6 `app/(app)/job-fit/page.tsx` glue
- [ ] H3.7 `app/(app)/job-fit/[jobId]/page.tsx` glue
- [ ] H3.8 `job-fit-list-page.tsx` orchestrator
- [ ] H3.9 `job-card.tsx`
- [ ] H3.10 `job-fit-detail-page.tsx` orchestrator
- [ ] H3.11 `job-score-block.tsx` (9-dim read-only sliders)
- [ ] H3.12 `match-reasons-block.tsx`
- [ ] H3.13 `study-topics-block.tsx` + `topic-chip.tsx` + dislike wiring
- [ ] H3.14 `detail-actions-bar.tsx`
- [ ] H3.15 `empty-state-need-cv.tsx` + `empty-state-back-to-list.tsx`
- [ ] H3.16 A11y pass (aria-labels, focus rings, keyboard nav)
- [ ] H3.17 Compile check `npm run build`
- [ ] H3.18 Manual smoke: refined-cv → CTA → list → detail → back

## Success Criteria
- Sidebar shows 5 nav items in order: Analyze, History, Optimizations, Career Path, Job Fit & Study.
- `/refined-cv` shows CTA button below polished CV.
- `/job-fit` with no CV in sessionStorage → empty state with CTA back to `/refined-cv`.
- `/job-fit` with CV → either loading → list with 5-10 cards, or graceful error.
- Each card shows title @ company · seniority · location · score badge · 3 reasons · 3 topic chips · "Xem chi tiết →".
- Detail page shows full 9-dim sliders (read-only), full reasons, full topics, "Cập nhật" badge, Apply link to `/api/r/[jobId]`.
- Dislike button visually responds optimistically; no console errors when `/api/topics/feedback` is 404 (graceful).
- All design tokens used; lighthouse a11y > 90.
- No leaked AI/prompt copy anywhere in UI (verified by grep for "system prompt", "LLM", "Gemini" in feature files — only allowed in dev logs).

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SessionStorage cleared mid-flow → detail page 404s | M | M | Detail empty state with "Generate again from list" CTA; sessionStorage keyed with version (`v1`) for migration |
| Direct-link share to `/job-fit/[jobId]` confuses recipient | H | L | Empty state explains: "Paste your CV at /job-fit to generate matches"; document in privacy.md |
| User generates 5/12 times then sees quota error | H | L | Surface quota remaining in CTA: "Còn lại: 3 lần hôm nay"; humanize 429 with reset time |
| 9 sliders feel overwhelming on detail page | M | L | Sliders grouped 3×3 grid w/ section labels; collapsible "Show all" toggle if signal weak |
| Dislike POST race when /api/topics/feedback not yet deployed | M | L | UI try/catch silently logs; chip still dims for the session |
| Mobile layout broken (existing dashboard-layout responsive) | M | M | Test on 375px viewport; use existing `card` + grid responsive patterns from career-path |
| Apply button opens in same tab, loses session | L | M | `target="_blank" rel="noopener noreferrer"` mandatory |
| User overrides scores expectation (memory note) | M | L | Slider disabled + tooltip: "Điểm do AI đánh giá, không chỉnh sửa được trên trang này" — distinct from refined-cv flow |

## Security Considerations
- SessionStorage is per-tab + per-origin; cleared on tab close. No persistent server-side leak.
- All POST requests CSRF-safe (Next.js same-origin default; no third-party iframe in app).
- `target="_blank"` always with `rel="noopener noreferrer"` (tab nabbing protection).
- No CV text in URL; CV only in sessionStorage + Phase 2 KV cache (HMAC-keyed).
- Dislike feedback payload: `{ jobId, topicId, action }` only — schema enforced client-side (zod or manual), no free-form text accepted (matches Phase 0 rule).

## Next Steps
- **Blocks:** None (UI is consumer; Phase 4 backend can ship in parallel).
- **Depends on:** Phase 2 (endpoint live).
- **Co-ships with:** Phase 4 (redirect + feedback routes; UI works in degraded mode if Phase 4 not yet merged).
