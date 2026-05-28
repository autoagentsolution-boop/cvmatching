# Career Path Feature — Plan

**Status:** In progress
**Created:** 2026-05-28 10:30 ICT
**Owner:** main session

## Goal

Replace `/career-path` stub with a working roadmap generator. Inputs: parsed CV (from `useAnalysis`) + user aspirations. Output: structured timeline of milestones, skill gaps, alternative paths, quick wins. LLM-backed, same BYOK / shared-key path as `/api/analyze`.

## Trade-off decisions (locked)

| Topic | Choice | Reason |
|---|---|---|
| Trigger | Hybrid: preload from `useAnalysis` if present, else show form requesting CV first | Avoids second CV upload, but page still usable solo |
| Input | Structured (target role, horizon, focus tags) + freeform notes | Lets non-experts pick from list, experts add nuance |
| Visualization | Vertical timeline cards | KISS — no new deps, matches design tokens |
| Quota | Separate `career-path` bucket: 3/day user, 2/day anon | Don't drain analyze budget; users iterate aspirations |
| State | Standalone `useCareerPath` store; reads `useAnalysis` for CV | Independent lifecycle, but reuses parsed CV |
| Response shape | `currentSnapshot` + `targetRole` + `milestones[3-6]` + `skillGaps[]` + `alternativePaths[1-2]` + `quickWins{30,60,90}` | Matches the diagram-style UX the user asked for |

## File plan (all <200 LOC)

**New:**
- `src/features/career-path/types.ts`
- `src/features/career-path/career-path-store.ts`
- `src/features/career-path/api-client.ts`
- `src/features/career-path/career-path-page.tsx`
- `src/features/career-path/aspiration-input-block.tsx`
- `src/features/career-path/current-snapshot-block.tsx`
- `src/features/career-path/roadmap-timeline-block.tsx`
- `src/features/career-path/skill-gaps-block.tsx`
- `src/features/career-path/alternative-paths-block.tsx`
- `src/features/career-path/quick-wins-block.tsx`
- `src/lib/llm/prompt-career-path.ts`
- `src/lib/llm/normalize-career-path.ts`
- `src/app/api/career-path/route.ts`

**Modified:**
- `src/lib/schemas/llm-request.ts` — add `CareerPathBody`
- `src/lib/quota/consume-quota.ts` — add `career-path` to QUOTA_LIMITS + ANON_QUOTA_LIMITS
- `src/app/(app)/career-path/page.tsx` — render `<CareerPathPage />`

## UX flow

1. User navigates to `/career-path`.
2. If `useAnalysis.cvText` empty → show "Analyze your CV first" empty state with CTA → `/`.
3. If CV present → render: current snapshot (read-only chips from analysis) + aspiration form + "Generate roadmap" button.
4. Form: `targetRole` (Select with role families + "custom"), `horizonYears` (1/3/5), `focusAreas` (multi-select: leadership, depth, breadth, switch-industry, switch-function, remote, startup, big-tech), `industryShift` (text optional), `constraints` (text optional), `notes` (textarea optional).
5. Submit → POST `/api/career-path` with `{ llm, inputs: { cvText, currentRole?, analysisSummary?, aspiration: {...} } }`.
6. Response → render: target role card, timeline (Card stack), skill gaps grid, alternative paths accordion, 30/60/90 quick wins.
7. "Refine" button re-opens form pre-filled; "Regenerate" submits again with same inputs.

## API contract

```ts
POST /api/career-path
Header: x-llm-api-key (if BYOK)
Body: {
  llm: { provider, model, temperature, baseUrl? },
  inputs: {
    cvText: string,
    analysisSummary?: string,        // from useAnalysis.result.summary if available
    currentRole?: string,            // from result.detectedRole if available
    aspiration: {
      targetRole: string,             // 'auto' allowed → LLM picks
      horizonYears: 1 | 3 | 5,
      focusAreas: string[],
      industryShift?: string,
      constraints?: string,
      notes?: string,
    },
    language: 'en' | 'vi' | 'auto',
  }
}
Response: CareerPathResult (see types.ts)
Errors: same code taxonomy as /api/analyze (invalid_input, quota_exceeded, llm_provider_error)
```

## Open questions (none blocking)

- Do we want PDF/share export? → Defer, parking lot.
- Should "Refine" call LLM with delta-only context? → No (KISS), full regen per submit.

## Todo

- [x] Plan
- [x] Schema + types
- [x] Prompt + normalizer
- [x] API route + quota wiring
- [x] Client store + api-client
- [x] Page + blocks
- [x] Compile + smoke test (tsc clean, `next build` green, route registered)
- [ ] Update memory snapshot + commit (pending user approval)

## Doc debt (deferred, non-blocking)

- `src/lib/usage/read-usage.ts` admin aggregation does not yet include `career-path` keys → admin dashboard underreports career-path KV counters. Adding fields would change `UserUsageRow`/`DailyGlobalRow` shape and the admin table; ship separately.
- `docs/deployment.md` does not list the new quota bucket — update before next deploy doc revision.
