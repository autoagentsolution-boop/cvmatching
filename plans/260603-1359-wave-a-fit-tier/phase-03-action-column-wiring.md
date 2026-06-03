# Phase 3 — Action Column Wiring

**Day:** Fri 2026-06-05 | **Effort:** 8-12h | **Status:** Complete (pulled forward to Wed; scoped down — see Deferred)

## Done

- `src/features/job-fit/action-button.tsx` — per-tier label + intent + href; S/A/B→`/refined-cv?jobId&mode=apply|fill-gaps`, C→stretch, D/E→`/career-path?target&skillGaps`
- `src/features/job-fit/job-card.tsx` — footer shows "Chi tiết" secondary + `<ActionButton size="sm">` primary
- `src/features/job-fit/detail-actions-bar.tsx` — refactored: takes `job: JobMatchOut`, renders per-tier ActionButton + suppresses "Mở trên source" for tier D/E (low-fit jobs)
- `src/features/job-fit/job-fit-detail-page.tsx` — passes `match` instead of `match.jobId`
- `src/lib/schemas/llm-request.ts` — `CvModeEnum` + `GenerateCvBody.inputs.mode` optional
- `src/features/analyze/types.ts` — `CvMode` export + `mode?` on `GenerateCvRequest.inputs`
- `src/lib/llm/prompt-generate-cv.ts` — `MODE_INSTR` map; user prompt appends `=== MODE ===` block with apply/fill-gaps/stretch instructions
- `src/lib/llm/normalize-job-recommend.ts` — added `description` to `JobMatchOut` so refine-from-job can run without re-fetch
- `src/features/refined-cv/refined-cv-mode-banner.tsx` — client island reads `?jobId&mode`, surfaces banner, synthesizes `analysisSummary` from match reasons + study topics, click-to-generate (no auto-fire)
- `src/features/refined-cv/refined-cv-view.tsx` — mounts mode banner above redflags banner under Suspense
- `src/features/career-path/career-path-page.tsx` — `useSearchParams` on mount: pre-fills `targetRole` + selects as suggestion + appends skill-gaps into `notes`; opens aspiration drawer
- `src/app/(app)/career-path/page.tsx` — Suspense boundary for `useSearchParams`
- `npx tsc --noEmit` clean

## Deferred (Phase 5 polish or follow-up)

- **Auto-fire generate-cv on arrival from query.** Banner currently waits for explicit click — avoids surprise spend per link. Re-evaluate once cost-guard headroom confirmed.
- **/api/jobs/{id} lookup endpoint** — banner falls back to session-store; if store empty (deep link, expired session), shows "Hãy quay lại Job Fit" copy instead of fetching. Acceptable until users complain.

## Goal

Render action button per job theo tier. Navigate to `/refined-cv` (S/A/B/C with mode) or `/career-path` (D/E with target + skillGaps) via query params. Existing pages pre-fill from query.

## Files

**Modify:**
- `cv-ex-refactor/src/features/job-fit/job-card.tsx` — render `<ActionButton tier={job.tier} job={job} />` bottom-right
- `cv-ex-refactor/src/features/job-fit/detail-actions-bar.tsx` — same action logic for detail view
- `cv-ex-refactor/src/features/job-fit/job-fit-store.ts` — add `actionLoading: Set<jobId>` + `setActionLoading()` (in case any inline action needed)
- `cv-ex-refactor/src/features/refined-cv/refined-cv-page.tsx` — read query `?jobId=&mode=apply|fill-gaps|stretch` → pre-load job context from store → auto-trigger generate-cv with mode
- `cv-ex-refactor/src/features/refined-cv/api-client.ts` (or equivalent) — generate-cv call accepts `mode` param
- `cv-ex-refactor/src/app/api/generate-cv/route.ts` — accept `mode` from body, pass to prompt builder
- `cv-ex-refactor/src/lib/llm/prompt-generate-cv.ts` — 3 prompt variants: apply/fill-gaps/stretch
- `cv-ex-refactor/src/lib/schemas/llm-request.ts` — `GenerateCvBody` adds `mode?: 'apply' | 'fill-gaps' | 'stretch'`
- `cv-ex-refactor/src/features/career-path/<page>.tsx` — read query `?target=&skillGaps=` → pre-fill form

**Create:**
- `cv-ex-refactor/src/features/job-fit/action-button.tsx` — `<ActionButton tier={t} job={j} />` chooses label + URL based on tier

## Spec — action-button.tsx

```tsx
type Props = { tier: TierLetter; job: JobMatchView };

const ACTION_PER_TIER: Record<TierLetter, {
  label: string;
  href: (job: JobMatchView) => string;
}> = {
  S: { label: 'Apply', href: (j) => `/refined-cv?jobId=${j.jobId}&mode=apply` },
  A: { label: 'Apply', href: (j) => `/refined-cv?jobId=${j.jobId}&mode=apply` },
  B: { label: 'Quick Fix', href: (j) => `/refined-cv?jobId=${j.jobId}&mode=fill-gaps` },
  C: { label: 'Improve', href: (j) => `/refined-cv?jobId=${j.jobId}&mode=stretch` },
  D: { label: 'Roadmap', href: (j) => `/career-path?target=${encodeURIComponent(j.jobTitle)}&skillGaps=${encodeURIComponent(j.studyTopics.slice(0,3).map(t=>t.label).join('|'))}` },
  E: { label: 'Roadmap', href: (j) => `/career-path?target=${encodeURIComponent(j.jobTitle)}&skillGaps=${encodeURIComponent(j.studyTopics.slice(0,3).map(t=>t.label).join('|'))}` },
};
```

## Spec — prompt-generate-cv.ts 3 modes

```ts
// Existing builder takes (cv, jd, target). Add mode param:
function buildGenerateCvPrompts({ cv, jd, target, mode }: Args) {
  const baseSystem = `...existing system prompt...`;
  const modeAddon = {
    'apply': '',  // default behavior
    'fill-gaps': '\n\nMODE: FILL GAPS — JD requirements bị thiếu evidence trong CV gốc, refine để thêm evidence cụ thể, KHÔNG fabricate. Nếu thực sự thiếu, ghi rõ "Cần bổ sung: ..." ở section riêng.',
    'stretch': '\n\nMODE: STRETCH — Job hơi vượt mức CV, refine để highlight transferable skills + learning trajectory + đam mê growth. Honest về gap.',
  }[mode ?? 'apply'];
  // ...
}
```

## Implementation steps

1. **action-button.tsx** — write per spec, ~50 LOC. Use Next `<Link>` cho navigate (preload + accessible).
2. **job-card.tsx** — add `<ActionButton tier={job.tier} job={job} />` bottom-right area.
3. **detail-actions-bar.tsx** — same logic, larger button.
4. **GenerateCvBody schema** — add `mode?: 'apply' | 'fill-gaps' | 'stretch'`.
5. **generate-cv route** — destructure `mode`, pass through to prompt builder. Default `'apply'`.
6. **prompt-generate-cv.ts** — add mode-aware system prompt suffix per spec.
7. **refined-cv-page** — read query params on mount (Next 16 useSearchParams), if `jobId+mode` present:
   - Load job context from `job-fit-store` (might already be in memory; if not, retry via `/api/jobs/by-id/{jobId}` — check if endpoint exists, else block until store has data)
   - Auto-trigger generate-cv with mode
   - Show mode banner: "Mode: Apply" / "Mode: Quick Fix" / "Mode: Stretch"
8. **career-path page** — read query `target` + `skillGaps`, pre-fill form fields. If user already has roadmap result in session, show "Bạn đã có roadmap. Generate lại với target mới?" CTA.
9. **Test full flow:**
   - Recommend results → click "Apply" on S tier job → /refined-cv pre-loads + generates
   - Click "Quick Fix" B tier → mode=fill-gaps prompt variant produces different output
   - Click "Roadmap" D tier → /career-path pre-filled
   - Test re-click: store handles loading state, no race

## Acceptance

- All 4 action types navigate correctly
- /refined-cv generates CV with correct mode prompt variant (manual diff check: apply vs fill-gaps vs stretch produce different content)
- /career-path pre-fills target + skillGaps from query
- Existing /refined-cv flow without query params (direct visit) still works
- Existing /career-path flow without query params still works

## Risks

- Job context not in store when user navigates → fallback: fetch job by ID. Add `/api/jobs/{id}` if missing.
- Query param truncation: skillGaps long → cap to top-3 (already in spec)
- Race when user spam-clicks "Apply" multiple times → Next Link is idempotent navigate, store handles loading
- Mode prompt produces too similar output → test all 3 with sample CV/JD, adjust prompt suffix if needed

## Next

Phase 4 — Cover Letter endpoint + UI wire.
