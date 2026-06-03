# Phase 2 — Atoms (3 new + 5 refined)

**Effort:** 2-3h | **Priority:** High | **Status:** Pending
**Brainstorm ref:** §5 Phase 2 + §9 atom contract

## Goal

Build 3 atom mới + refine 5 atom hiện có để Phase 3 chỉ việc wire vào `/analyze` sections.

## Files

**Create:**
- `cv-ex-refactor/src/components/ui/chip.tsx` — `<Chip variant="must-have" checked>` (D1)
- `cv-ex-refactor/src/components/ui/primary-cta-eta.tsx` — sticky footer CTA + ETA (D4)
- `cv-ex-refactor/src/components/ui/industry-preset-selector.tsx` — preset dropdown (D7)
- `cv-ex-refactor/src/lib/presets/industry-presets.ts` — JSON 5-6 industries

**Modify:**
- `cv-ex-refactor/src/components/ui/slider.tsx` — add `variant="polished"` (D5)
- `cv-ex-refactor/src/components/ui/drop-zone.tsx` — empty-state copy + paste fallback link (D6)
- `cv-ex-refactor/src/components/ui/empty-state.tsx` — add `variant="hint"` (D3)
- `cv-ex-refactor/src/components/ui/loading-state.tsx` — add `variant="section"` (D2)
- `cv-ex-refactor/src/components/ui/error-state.tsx` — add `variant="section"` (D2 đối xứng)
- `cv-ex-refactor/src/components/ui/index.ts` — export new atoms

## Atom contracts

### chip.tsx
```tsx
type ChipProps = {
  variant?: 'default' | 'must-have';
  checked?: boolean;       // green check icon visible
  children: ReactNode;
  onRemove?: () => void;   // X button (future iteration)
};
```
Style: rounded-full nếu `must-have`, padding tight, border subtle, green check 14px khi checked.

### primary-cta-eta.tsx
```tsx
type Props = {
  hasResume: boolean;
  hasJD: boolean;
  mustHavesStatus: 'idle' | 'extracting' | 'ready' | 'error';
  etaSeconds: [number, number];
  onSubmit: () => void;
  isSubmitting?: boolean;
};
// disabled = !hasResume || !hasJD || mustHavesStatus === 'error'
// Hint khi error: "Re-extract must-haves to continue"
// Hint khi missing input: "Upload CV and paste JD to continue"
// Layout: sticky bottom, fixed height (CLS guard), opacity transition khi state đổi
// ETA: "Estimated processing time: 4-6 seconds" — chỉ show khi enabled
```

### industry-preset-selector.tsx
```tsx
type Preset = {
  id: string;
  label: string;        // "Software Engineer"
  targetRole: string;
  strictness: 'lenient' | 'balanced' | 'strict';
  outputLanguage: 'match-jd' | 'vi' | 'en';
  toggles: {
    compareBenchmarks: boolean;
    atsReadability: boolean;
    aiActionVerbs: boolean;
  };
  // NO slider weights — preserve feedback_scoring_ux_model
};

type Props = {
  value: string;                     // preset id
  onValueChange: (id: string) => void;
  presets: Preset[];
};
```

### industry-presets.ts
5 presets initial:
1. `software-engineer` — Software Engineer, strict, match-jd, all toggles on
2. `data-scientist` — Data Scientist, strict, match-jd, all on
3. `product-manager` — Product Manager, balanced, vi, ATS + verbs on
4. `marketing` — Marketing Specialist, balanced, vi, ATS + verbs on
5. `sales` — Sales Representative, lenient, vi, benchmarks on
6. `custom` — sentinel "Standard" default, no override

### slider.tsx variant="polished"
- Gradient track: light-to-saturated brand color theo value
- Intensity ramp: 0-40% mute, 40-70% solid, 70-100% vivid
- Preserve existing API; chỉ thêm `variant` prop

### drop-zone.tsx
- Empty state: 64px icon centered + "Drop your resume here" + small hint "Click to browse or drag a file" + "Or paste your CV text" link

### empty-state.tsx variant="hint"
- Subtle text inline, muted color, no icon (vs default which có icon center)
- Use case: "Recommended 30+ words for better accuracy" dưới JD textarea

### loading-state.tsx variant="section"
- Inline trong section card, NOT full-page overlay
- Spinner 24px + label "Extracting must-haves from JD…"

### error-state.tsx variant="section"
- Đối xứng loading section
- Icon + message + retry CTA. Surfacing 4xx/5xx (feedback_error_surfacing rule)

## Implementation steps

1. Read existing atom files để hiểu pattern (props convention, cn() usage, export from index.ts).
2. Create new atoms 1 file/atom, ~50-80 LOC each.
3. Refine existing atoms (additive variant props, không break API).
4. Update `components/ui/index.ts` exports.
5. Demo route `app/(dev)/atoms/page.tsx` (optional, dev-only) — render mọi state để visual check.
6. Typecheck + lint.
7. Commit `feat(ui): add atoms for analyze polish (chip, cta-eta, preset)`.

## Acceptance

- All new atoms render mọi state without console warnings
- Existing atom consumers KHÔNG break (no API change, only additive variants)
- Demo route (nếu có) show all states
- Typecheck + lint xanh
- Screenshot `passE-phase2-atoms.png` from demo route saved

## Risks

- **Atom API drift:** Adding variant prop default phải preserve old behavior. Mitigation: explicit defaults trong types.
- **Slider polish phá scoring UX:** variant phải opt-in, default unchanged. Mitigation: test current /analyze sau khi slider refine — no behavior change unless variant="polished" set.

## Next

Phase 3 — wire atoms vào /analyze page.
