# Brainstorm Report — UI Polish Pass (/analyze + shell)

**Date:** 2026-06-03 12:05
**Status:** Approved design, plan execution **deferred — sau hybrid-refresh-topup**
**Source of truth:** `UIEnhance/*.png` (UIUXSpace.png, 2026-05-27_14-02.png, RequirementLoad.png)
**Current state baseline:** `plans/reports/passD-analyze-with-jd.png`

---

## 1. Problem statement

Visual + UX polish pass đưa `/analyze` page và app shell (sidebar/topbar/auth shell) từ "functional" lên "production-grade pretty". Skeleton + features đã match mockup; cần đóng các delta về tokens, atoms mới, empty/loading states, và 1 component preset mới.

**KHÔNG bao gồm:** History, Optimizations, Career Path, Pricing, Settings, /sign-in. Polish riêng khi có mockup.

**KHÔNG đụng:** BE endpoints, scoring semantic, recommendation logic, embeddings.

---

## 2. Stack & constraints (đã verify)

| Item | Value |
|------|-------|
| CSS | Tailwind v4 (`@theme` CSS vars trong `src/app/globals.css`) |
| Utility | `clsx` + `tailwind-merge` qua `cn()` |
| Framework | Next 16.2.6 App Router, RSC default |
| Atom lib | Custom `src/components/ui/` — KHÔNG shadcn/Radix |
| Must-haves data | Đã có `/api/extract-must-haves` + `features/analyze/must-haves-block.tsx` + `api-client.ts` |

**Mandatory rules (memory):**
- `feedback_ui_ux_design_system` → tokens-first, shared components, layout templates, no leaked prompt text
- `feedback_scoring_ux_model` → giữ semantic 9 sliders = LLM score, user override → overall recompute client-side
- `feedback_error_surfacing_no_silent_fallback` → loading state must-haves PHẢI có error state đối xứng

---

## 3. Deltas mockup vs current (D1–D8)

| ID | Delta | Section | Severity |
|----|-------|---------|----------|
| D1 | Must-have requirements UI = chip pills xanh + green check + "Re-extract" link | §3 | High |
| D2 | Loading state riêng cho must-haves ("Extracting must-haves from JD…" + spinner) | §3 | High |
| D3 | Empty-state hint "Recommended 30+ words for better accuracy" dưới JD textarea | §2 | Med |
| D4 | Disabled primary CTA + ETA "Estimated processing time: 4-6 seconds" sticky footer | Bottom | High |
| D5 | Slider progress bars gradient/intensity màu xanh thay vì solid | §3 | Med |
| D6 | Empty-state 2 upload cards: icon + 2-line text + paste fallback link | §1 + §2 | Low (đã có drop-zone) |
| D7 | Preset "Standard" dropdown (Recommended defaults per industry) | §3 header | New feature |
| D8 | Spacing / divider / card elevation đồng đều toàn page | All | Low-Med |

---

## 4. Evaluated approaches

| Approach | Order | Pros | Cons | Verdict |
|----------|-------|------|------|---------|
| A. Token-first bottom-up | tokens → atoms → page → shell | Enforces design-system contract; downstream pages auto-benefit | Wide blast radius trước visual win | **Adopt for Phase 1+2** |
| B. Page-first top-down | /analyze → extract atoms khi repeat | Visible progress nhanh; YAGNI | Drift khỏi system; vi phạm `feedback_ui_ux_design_system` | Reject — vi phạm rule |
| C. Vertical slice per delta | D1→…→D8 atomic | Ship-able micro-PRs | Slow; thiếu holistic review | Reject — overhead cao |

**Final: A→B hybrid 4 phases** (Phase 1+2 bottom-up foundation, Phase 3 top-down wire, Phase 4 polish).

---

## 5. Recommended design — 4 phases

### Phase 1 — Token + shell foundation (2-3h)

**Files:**
- `src/app/globals.css` — refresh `@theme` CSS vars
- `src/components/layout/sidebar.tsx` (or equivalent) — active state, hover, Upgrade-Pro card styling
- `src/components/layout/topbar.tsx` — logo + sign-in styling

**Token scope:**
- Color: brand blue, success green, neutral grey scale, error red, muted backgrounds
- Space scale: tight (4/8/12) for chips, regular (16/24/32) for cards, large (48/64) for sections
- Radius: 6px (chip), 12px (card), 16px (CTA)
- Shadow: card-rest, card-hover, sticky-footer
- Motion: 150ms ease-out (interactions), 250ms ease-in-out (page-level)

**Acceptance:** passD shell visuals match mockup pixel-near; existing atoms inherit new tokens without manual edits.

### Phase 2 — New/refined atoms (2-3h)

**New atoms:**
- `src/components/ui/chip.tsx` — `<Chip variant="must-have" checked={bool}>` với green check icon. Extends `badge.tsx` pattern hoặc standalone.
- `src/components/ui/primary-cta-eta.tsx` — `<PrimaryCTAWithETA disabled={bool} etaSeconds={[lo,hi]}>` — sticky footer CTA + processing time hint.
- `src/components/ui/industry-preset-selector.tsx` — `<IndustryPresetSelector value onValueChange>` driven bởi JSON presets.
- `src/lib/presets/industry-presets.ts` — 5-6 industries: Software Engineer, Data Scientist, Product Manager, Marketing, Sales. Mỗi preset = `{ targetRole, strictness, outputLanguage, toggles }`.

**Refined atoms:**
- `slider.tsx` → variant `"polished"` với gradient track + intensity color tied to value.
- `drop-zone.tsx` → empty-state copy + paste-fallback link (D6).
- `empty-state.tsx` → variant `"hint"` cho D3 (subtle, dưới textarea).
- `loading-state.tsx` → variant `"section"` cho D2 (inline trong section, không full-page).
- `error-state.tsx` → variant `"section"` đối xứng D2 (cho `feedback_error_surfacing_no_silent_fallback`).

**Acceptance:** mỗi atom có 1 demo route (`/dev/atoms` hoặc Storybook-style) hoặc unit test render.

### Phase 3 — Wire /analyze page section by section (3-4h)

**File touchpoints:**
- `src/features/analyze/analysis-parameters-block.tsx` — preset dropdown header (D7), polished sliders (D5)
- `src/features/analyze/must-haves-block.tsx` — chip pills (D1), section loading (D2), section error
- `src/features/analyze/upload-resume-block.tsx` / `upload-jd-block.tsx` (or equivalent) — empty-state polish (D6), JD hint (D3)
- `src/app/(app)/analyze/page.tsx` (or wherever) — sticky CTA replace bằng `<PrimaryCTAWithETA>` (D4)

**Order trong section:**
1. §1 + §2 upload cards → atoms mới
2. §3 header: preset dropdown + selectors styling
3. §3 must-haves: chips + loading + re-extract + error
4. §3 sliders: polished variant (giữ semantic LLM-score override)
5. §3 footer toggles: visual polish
6. Sticky bottom: `<PrimaryCTAWithETA>`

**Acceptance:** Playwright screenshot `/analyze` (empty, with-JD, with-CV+JD, error states) match mockup; no layout shift on JD paste.

### Phase 4 — Snapshot diff + tweak (1-2h)

- Side-by-side screenshot vs mockup, list residual deltas
- Spacing / divider / elevation đồng đều (D8)
- Reduced-motion check (`prefers-reduced-motion`)
- Mobile responsive sanity (≥320px)
- CLS check khi must-haves loading → resolved
- Snapshot mới `passE-analyze-*.png` vào `plans/reports/`

**Acceptance:** passE screenshots = ship-ready.

---

## 6. Implementation considerations & risks

| Risk | Mitigation |
|------|-----------|
| Tailwind v4 `@theme` syntax khác v3 | Phase 1 verify build first; consult `docs-seeker` cho v4 docs nếu cần |
| Existing atom consumers break khi refresh tokens | Phase 1 grep all imports of affected tokens; run typecheck + visual smoke trước commit |
| Slider polish phá vỡ scoring semantic | Test override flow end-to-end: change slider → overallScore recompute client-side, recommendations frozen |
| Must-haves loading + error state miss API states | List tất cả states: idle / extracting / success / error 4xx / error 5xx / empty result. Atom + parent handle hết |
| CLS khi `<PrimaryCTAWithETA>` enable/disable swap | Fixed height container, opacity/text-swap thay vì re-mount |
| Industry presets thiếu (hardcoded JSON) | YAGNI — ship 5 preset cứng, defer i18n / custom-saved-preset đến iteration sau |
| Sticky footer mobile overlap content | Test viewport ≤768px, add `padding-bottom` matching footer height |

---

## 7. Success metrics

- Pixel-similarity ≥85% với UIEnhance mockup (snapshot diff)
- 0 console warnings (Tailwind v4 unknown utilities, React key warnings)
- Lighthouse Accessibility ≥95 trên /analyze
- CLS <0.1 trên load + JD paste flow
- Typecheck + lint clean
- Manual flow check: idle → paste JD → extract must-haves → upload CV → submit → results unchanged (regression check)

---

## 8. Next steps

1. **Defer execution.** Queue: `vertical-aware rec` (WIP) → `pilot re-enable runbook` → `hybrid-refresh-topup R1-R7` → **này**.
2. **Spawn `/ck:plan`** với context report này, naming `260603-1205-ui-polish/`. Plan dir = pending until queue clears.
3. Khi execute: planner agent tạo phase files Phase 1-4 (theo `documentation-management.md` plan structure).

---

## 9. Resolved decisions (chốt 2026-06-03)

| Q | Decision | Implication |
|---|----------|-------------|
| Sidebar Upgrade-Pro copy | Final — polish visual only | Phase 1 chỉ touch styling, không sửa text |
| CTA disable rule | Disable khi thiếu CV/JD **HOẶC** must-haves error | `<PrimaryCTAWithETA>` nhận 3 state-derived flags: `hasResume`, `hasJD`, `mustHavesStatus`. Khi `mustHavesStatus === 'extracting'` → CTA enabled (parallel), khi `'error'` → disabled với hint "Re-extract must-haves to continue" |
| Preset vs dirty sliders | Preset **KHÔNG** động sliders — chỉ apply 4 selector + toggles | Preserve `feedback_scoring_ux_model` semantic. `<IndustryPresetSelector>` emit `{ targetRole, strictness, outputLanguage, toggles }`, không emit slider weights. Document trong atom prop comment |
| Tailwind v4 + Next 16.2.6 | Verified at runtime (đang ship đều) | Re-check nếu Phase 1 build fails; fallback = pin minor version |

### Atom contract update (Phase 2)

```tsx
// primary-cta-eta.tsx
type Props = {
  hasResume: boolean;
  hasJD: boolean;
  mustHavesStatus: 'idle' | 'extracting' | 'ready' | 'error';
  etaSeconds: [number, number];
  onSubmit: () => void;
};
// disabled = !hasResume || !hasJD || mustHavesStatus === 'error'
// hint khi error: "Re-extract must-haves to continue"

// industry-preset-selector.tsx
type Preset = {
  id: string;
  label: string;
  targetRole: string;
  strictness: 'lenient' | 'balanced' | 'strict';
  outputLanguage: 'match-jd' | 'vi' | 'en';
  toggles: { compareBenchmarks: boolean; atsReadability: boolean; aiActionVerbs: boolean };
  // NO slider weights — sliders remain LLM-driven per feedback_scoring_ux_model
};
```
