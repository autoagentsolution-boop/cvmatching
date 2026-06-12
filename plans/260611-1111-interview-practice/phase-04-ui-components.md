# Phase 04 — UI Components (Mode Select, Role Picker, Question Card, Results, Dashboard Widget)

## Context Links
- Memory: `feedback_no_auto_llm_calls` — Start + Submit MUST be explicit button clicks. Never fire from useEffect / route change / state transition.
- Memory: `feedback_react_stable_jsx_tree` — answer ↔ grade view transitions: toggle CSS classes, do NOT swap wrapper element type (subtree unmount loses state)
- Memory: `feedback_admin_page_perf_pattern` — dashboard widget (server component): `preferredRegion='sin1'` + Promise.all + sibling `loading.tsx`
- Memory: `feedback_default_param_short_circuits_nullish` — dual lens card props: pick default OR nullish fallback, not both
- Memory: `feedback_rsc_no_function_props` — server → client component boundary: pass data only, never function callbacks
- Memory: `feedback_ui_ux_design_system` — use tokens, shared components, layout templates; never leak prompt/AI text into UI strings
- Memory: `feedback_error_surfacing_no_silent_fallback` — 402 BYOK must show actionable CTA "Open Settings"
- Related files: existing `cv-ex-refactor/src/components/job-fit/*`, `cv-ex-refactor/src/components/ui/*`, `cv-ex-refactor/src/lib/i18n/use-t.ts`

## Overview
- **Priority:** P1 (blocks Phase 06 E2E)
- **Status:** pending
- **Description:** Build the Interview Practice surface from chevron landing → role picker → in-progress Q form → results page, plus dashboard history widget. Stable JSX tree, no auto-LLM, explicit user actions only.

## Key Insights
- Two button states matter: "Start interview" (fires `interview_gen`) and "Submit answers" (fires `interview_grade`). Both MUST be disabled until inputs valid; both MUST be loading-state-managed.
- Question card has 3 states: empty answer / answer being typed / graded (after submit returns). Must use ONE wrapper element with CSS class toggles — not conditional JSX swapping `<div>` ↔ `<article>` etc.
- Role picker for standalone mode is a free-text input + autocomplete from common titles (optional v2); v1 = plain text input.
- Dashboard widget = server component reading `/api/interview/history` data via direct storage call (no network roundtrip).
- 402 error path: full-page CTA → "Settings" deep link. Do not show a half-broken interview page.

## Requirements
**Functional:**
- `/interview` landing: mode select (job_fit pre-filled from query string `?jobId=...` OR manual standalone). Anchor role dropdown from CV. Provider dropdown (gemini/openai/anthropic). Big "Start interview" button.
- `/interview/[id]`: shows Dual Lens cards + 10 question cards; one textarea per Q; "Submit all answers" button at bottom, disabled until all 10 non-empty.
- `/interview/[id]/results`: read-only view of all 10 Q + answers + grades + overall score + Dual Lens.
- Dashboard widget: top 5 recent sessions with link to results.

**Non-functional:**
- All client components < 200 lines.
- Use existing UI tokens (no inline hex colors).
- VI/EN strings via `useT()` (Phase 05 wires keys).
- No auto-fire LLM calls — every LLM-triggering action is a button onClick.
- Stable JSX tree for question card.

## Architecture
```
/interview (server component)
  ├─ load CV roles for anchor dropdown (server-side)
  └─ <ModeSelect> + <RolePicker> + <ProviderSelect> + <StartButton>
        └─ on click → POST /api/interview/start
              ├─ 200 → router.push(`/interview/${sessionId}`)
              ├─ 402 → show <ByokMissingCta>
              ├─ 409 → router.push to existing sessionId
              └─ 503 → toast retry

/interview/[id] (server component)
  ├─ GET /api/interview/[id] (via direct storage call)
  ├─ if status='completed' → redirect to /results
  └─ <DualLensCard> + <QuestionCard>[10] + <SubmitButton>
        └─ on click → POST /api/interview/submit
              └─ 200 → router.push(`/interview/${sessionId}/results`)

/interview/[id]/results (server component)
  └─ <ResultsSummary> + <DualLensCard> + <QuestionCard read-only>[10]

Dashboard:
  <HistoryWidget> server component → direct storage call
```

## Related Code Files
**Create:**
- `cv-ex-refactor/src/app/(dashboard)/interview/page.tsx` — landing (server)
- `cv-ex-refactor/src/app/(dashboard)/interview/[id]/page.tsx` — in-progress (server, hydrates client form)
- `cv-ex-refactor/src/app/(dashboard)/interview/[id]/results/page.tsx` — results (server)
- `cv-ex-refactor/src/app/(dashboard)/interview/loading.tsx` — skeleton
- `cv-ex-refactor/src/components/interview/mode-select.tsx` — client
- `cv-ex-refactor/src/components/interview/role-picker.tsx` — client (CV-role dropdown OR standalone text input based on mode)
- `cv-ex-refactor/src/components/interview/provider-select.tsx` — client
- `cv-ex-refactor/src/components/interview/start-button.tsx` — client (fires start, handles 402/409/503)
- `cv-ex-refactor/src/components/interview/dual-lens-card.tsx` — server-friendly presentational (data-only props)
- `cv-ex-refactor/src/components/interview/question-card.tsx` — client (stable wrapper, CSS-class state toggle)
- `cv-ex-refactor/src/components/interview/submit-button.tsx` — client (fires submit when all 10 answered)
- `cv-ex-refactor/src/components/interview/results-summary.tsx` — presentational
- `cv-ex-refactor/src/components/interview/history-widget.tsx` — server component (data-only)
- `cv-ex-refactor/src/components/interview/byok-missing-cta.tsx` — client (deep link to /settings)

**Modify:**
- `cv-ex-refactor/src/app/(dashboard)/job-fit/.../page.tsx` (existing chevron area) — add link "Interview Practice" pointing to `/interview?jobId=...`
- Dashboard root page — mount `<HistoryWidget>` in sidebar/section

**Delete:** none

## Implementation Steps
1. Create `loading.tsx` skeleton at `(dashboard)/interview/` for the route group.
2. Create `(dashboard)/interview/page.tsx`:
   - `preferredRegion='sin1'`.
   - Read `?jobId=` from `searchParams`.
   - Server-side load CV roles for current user via existing fetcher.
   - Render mode select + role picker + provider select + start button. Pass data-only props.
3. Create `mode-select.tsx` (client) — 2-tab toggle (`job_fit` / `standalone`); writes mode into a shared client state (lift state into a small `interview-form-state.tsx` provider or use URL state).
4. Create `role-picker.tsx` (client):
   - If mode=job_fit → readonly chip showing target job title + dropdown of CV original roles for anchor.
   - If mode=standalone → free-text input for target role title + dropdown of CV roles for anchor.
   - Emits `{ jobId?, roleTitle?, anchorRoleId }` to parent state.
5. Create `provider-select.tsx` (client) — dropdown gemini/openai/anthropic; default = gemini.
6. Create `start-button.tsx` (client):
   - `onClick={async () => { POST /api/interview/start; route by status }}`. Disabled until form valid.
   - On 402 → show `<ByokMissingCta>` (replace button area).
   - Add inline comment: `// LLM-consuming — onClick only. See memory: feedback_no_auto_llm_calls`.
7. Create `(dashboard)/interview/[id]/page.tsx`:
   - Server load via direct `getSessionById` call.
   - If status='completed' → `redirect('/interview/[id]/results')`.
   - If status='abandoned' → show "session expired" + link back.
   - Render dual lens + 10 question cards + submit button.
8. Create `dual-lens-card.tsx` — presentational, 4-quadrant grid. Tailwind tokens. Each quadrant shows reasons/signals/etc. Use design tokens, no inline hex.
9. Create `question-card.tsx`:
   - **Stable wrapper**: one `<article>` always. State toggle via CSS class `data-state="empty|typing|graded"`.
   - In `empty/typing`: textarea + character counter.
   - In `graded` (results page): textarea read-only + grade pill + feedback list + improvements list.
   - Inline comment: `// Wrapper element MUST NOT swap by state. See memory: feedback_react_stable_jsx_tree`.
10. Create `submit-button.tsx` (client):
    - Disabled until all 10 answers length > 0.
    - `onClick` POST `/api/interview/submit`. Show progress toast (grading ~10s).
    - On 200 → `router.push('/results')`. On non-2xx → classified toast.
    - Inline comment: `// LLM-consuming — onClick only. See memory: feedback_no_auto_llm_calls`.
11. Create `(dashboard)/interview/[id]/results/page.tsx` (server) + `results-summary.tsx`:
    - Display overall score + Dual Lens + 10 read-only question cards.
    - Print/share intentionally absent in v1.
12. Create `history-widget.tsx` (server) — direct `listUserHistory` call; render 5 most recent; link to `/interview/[id]/results`.
13. Modify Job Fit chevron area — add "Interview Practice" CTA `<Link href={\`/interview?jobId=\${id}\`}>`.
14. Run `pnpm tsc --noEmit` and `pnpm build` to catch RSC boundary errors and Tailwind issues.

## Todo List
- [ ] loading.tsx skeleton
- [ ] /interview landing page (server)
- [ ] mode-select.tsx
- [ ] role-picker.tsx (both modes)
- [ ] provider-select.tsx
- [ ] start-button.tsx with 402/409/503 handling
- [ ] /interview/[id] page (server) with completed → redirect / abandoned → notice
- [ ] dual-lens-card.tsx
- [ ] question-card.tsx (stable wrapper)
- [ ] submit-button.tsx
- [ ] /interview/[id]/results page (server)
- [ ] results-summary.tsx
- [ ] history-widget.tsx
- [ ] byok-missing-cta.tsx
- [ ] Job Fit chevron CTA wired
- [ ] tsc + build green; no RSC errors

## Success Criteria
- User navigates from Job Fit chevron → /interview?jobId=X → fills form → clicks Start (only then LLM fires) → answers 10 Q → clicks Submit (only then grade LLM fires) → views results.
- 402 BYOK error renders CTA, not a broken page.
- 409 redirects to existing in-progress session.
- Question card never remounts on state transition (verify by typing → state change → text persists).
- History widget shows recent 5 on dashboard.
- VI/EN keys wired via `useT()` (keys defined in Phase 05).
- All files < 200 lines.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| useEffect accidentally fires start on mount | M | H | Inline comment + code-review checklist; tester agent verifies no useEffect → fetch in Phase 06 |
| Conditional JSX swaps wrapper on grade state → iframe/textarea state lost | M | M | Inline comment per memory; PR review |
| RSC passes function callback to client component → 500 at render | M | H | All components designed data-only; lift state inside client tree |
| Tailwind v4 oklch issue (if we add PDF later) | L | M | N/A v1 (no PDF export) |
| User types long answer → exceeds prompt token budget | M | M | Char counter + soft cap 1200 chars/Q in UI |
| Provider switch mid-session not supported | L | L | Provider locked to session.byok_provider; UI disables switcher in /[id] page |

## Security Considerations
- BYOK key never reaches client component — start route reads it server-side.
- Rubric never rendered (server strips it from response).
- Output rendered via React text nodes — no `dangerouslySetInnerHTML`.
- Settings link in BYOK CTA uses internal `<Link>`, no external redirect.

## Next Steps
- Phase 05 wires i18n keys for everything `useT()`-bound here.
- Phase 06 tests E2E flow + verifies no auto-LLM.
