# Phase 3 — Action Column Wiring

**Day:** Fri 2026-06-05 | **Effort:** 8-12h | **Status:** Pending

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
