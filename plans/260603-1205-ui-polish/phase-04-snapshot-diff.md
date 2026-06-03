# Phase 4 — Snapshot Diff + Ship Polish

**Effort:** 1-2h | **Priority:** Med | **Status:** Pending
**Brainstorm ref:** §5 Phase 4

## Goal

Side-by-side snapshot vs mockup, list + fix residual deltas, sanity check edge cases, sign off ship-ready.

## Steps

### Snapshot capture

1. Playwright capture `/analyze` 6 states:
   - Empty (no CV, no JD)
   - Empty CV + JD pasted (extracting must-haves)
   - Empty CV + JD pasted (must-haves ready, chips visible)
   - Empty CV + JD error (must-haves 4xx)
   - CV + JD ready (CTA enabled, ETA visible)
   - Mid-submit (loading state)

   Save as `plans/reports/passE-analyze-{state}.png`

2. Side-by-side diff với mockup `UIEnhance/UIUXSpace.png`:
   - List residual visual deltas
   - For each: classify (must-fix / nice-to-have / accept)

### Polish residual

3. Fix must-fix deltas (typical: spacing, divider weight, card elevation D8)
4. Reduced-motion check: add `prefers-reduced-motion` guards cho transitions
5. Mobile responsive check ≥320px:
   - Sidebar collapses to hamburger
   - Sticky footer doesn't overlap content (padding-bottom matching footer height)
   - Cards stack vertical, chips wrap

### Sanity

6. Lighthouse audit `/analyze`:
   - Accessibility ≥95
   - Performance ≥85 (mobile)
   - CLS <0.1
7. Console warnings: 0
8. Tailwind v4 unknown utility warnings: 0
9. React key warnings: 0

### Regression

10. Manual flow end-to-end:
    - Paste JD → must-haves extract → CV upload → submit → result page
    - Slider override → overall recompute → recommendations frozen
    - Preset switch → 4 selector + toggles apply, sliders untouched
    - Reset button → sliders back to AI scores

11. Compare submitted analyze request payload BEFORE polish vs AFTER polish — verify identical (no semantic drift).

### Ship

12. Commit `feat(ui): /analyze polish pass complete`
13. PR description includes:
    - Before/after screenshots (passD vs passE)
    - Lighthouse score delta
    - Touched files summary
    - Memory rules verification: design system ✓ / scoring semantic ✓ / error surfacing ✓
14. Tag PR for review

## Acceptance

- All 6 snapshot states match mockup ≥85% pixel-similarity
- 0 console warnings
- Lighthouse a11y ≥95, CLS <0.1
- Regression: 0 behavior changes vs baseline
- PR description complete

## Risks

- **Pixel-similarity threshold too strict:** Mockup là design ref, không phải exact spec. Allow ≥85% với written justification for residual.
- **Mobile responsive breaks at narrow width:** test 320px, 375px, 414px. Fix or document min-width support.

## Done criteria

PR merged to main. Update `260527-1117-phase-1-1-polish-queue` plan: mark §B + §C items resolved by this polish pass.
