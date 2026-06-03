# Phase 3 — Wire Atoms vào /analyze Page

**Effort:** 3-4h | **Priority:** High | **Status:** Pending
**Brainstorm ref:** §5 Phase 3

## Goal

Replace inline styles/markup trong `/analyze` page sections bằng atoms từ Phase 2. End state: visual match mockup.

## Files

**Modify:**
- `cv-ex-refactor/src/features/analyze/analysis-parameters-block.tsx` — preset dropdown (D7), polished sliders (D5)
- `cv-ex-refactor/src/features/analyze/must-haves-block.tsx` — chip pills (D1), loading/error sections (D2)
- `cv-ex-refactor/src/features/analyze/upload-resume-block.tsx` (verify path) — empty-state polish (D6)
- `cv-ex-refactor/src/features/analyze/upload-jd-block.tsx` (verify path) — empty-state + JD hint (D3, D6)
- `cv-ex-refactor/src/app/(app)/analyze/page.tsx` — sticky CTA replace với `<PrimaryCTAWithETA>` (D4)

**Read (context):**
- `cv-ex-refactor/src/features/analyze/api-client.ts` — must-haves extraction trigger
- `cv-ex-refactor/src/features/analyze/use-analysis.ts` (hoặc state hook) — wire CTA enable/disable

## Implementation steps (in order)

### §1 + §2 — Upload cards
1. Replace upload card markup với refined `<DropZone>` (empty-state + paste fallback)
2. Add `<EmptyState variant="hint">` "Recommended 30+ words for better accuracy" dưới JD textarea
3. Visual smoke: empty / partially-filled / filled states

### §3 header — Preset + selectors
4. Add `<IndustryPresetSelector>` ở top section 3
5. Wire `onValueChange`: apply 4 selector + toggles values; **DO NOT** touch sliders state
6. Style 3 selectors (Target role / Strictness / Output language) với new tokens
7. Test: chỉnh sliders → chọn preset → verify sliders KHÔNG đổi

### §3 must-haves
8. Replace must-haves rendering bằng `<Chip variant="must-have" checked>` map
9. Wire "Re-extract" link → trigger api-client refetch
10. Loading state: `<LoadingState variant="section" label="Extracting must-haves from JD…">`
11. Error state: `<ErrorState variant="section">` với retry CTA — surface 4xx/5xx message
12. Test states: idle / extracting / success-with-chips / 4xx-error / 5xx-error

### §3 sliders
13. Change `<Slider>` props to `variant="polished"`
14. Verify scoring semantic intact: drag slider → overallScore recompute client-side, recommendations frozen
15. Test reset button still works (resets to AI scores per fix `87f447d`)

### §3 footer toggles
16. Polish 3 toggles visual với new tokens
17. Verify preset apply correctly affects toggles

### Sticky bottom CTA
18. Replace existing submit button với `<PrimaryCTAWithETA>`
19. Wire props:
    - `hasResume = resumeText.length > 0 || resumeFile != null`
    - `hasJD = jdText.length > 0 || jdFile != null`
    - `mustHavesStatus = derived from must-haves block state`
    - `etaSeconds = [4, 6]`
20. Test enable/disable matrix:
    - No CV → disabled, hint "Upload CV..."
    - No JD → disabled
    - Both + must-haves extracting → **enabled** (parallel)
    - Both + must-haves error → **disabled**, hint "Re-extract..."
    - Both + must-haves ready → enabled
21. CLS check: fixed-height container, opacity swap

## Acceptance

- Visual `/analyze` page match mockup pixel-near
- Scoring semantic intact: slider drag → overall recompute, recommendations frozen
- Preset apply: 4 selector + toggles only, sliders untouched
- Must-haves error state visible (no silent fallback)
- CTA disable matrix correct
- CLS <0.1 trên JD paste flow
- Manual regression: full analyze flow end-to-end, results unchanged from baseline

## Risks

- **Must-haves loading state race:** if JD paste → extract starts → user submits → submit goes through (per decision: extracting ≠ block). Make sure server-side analyze handles missing must-haves gracefully (already does — verify).
- **Preset apply unexpected behavior:** if preset toggles affect downstream (e.g., outputLanguage changes API call). Test downstream propagation.
- **Slider polished variant visual regression in dark mode** (nếu app có dark): test both modes.

## Next

Phase 4 — snapshot diff + final polish.
