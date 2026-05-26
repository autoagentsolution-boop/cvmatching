# Phase 03 — UI Implementation (Stitch Design)

## Context

- **Brainstorm:** [../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md](../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md)
- **Logic source:** `../../cv_fit_scoring_app.html` (port state/types/LLM logic only — NOT visual)
- **Design source (visual truth):** `../../CVEXRefactor/stitch_ai_resume_optimizer/`
  - `precision_career_interface/DESIGN.md` — tokens
  - `trang_ng_nh_p/code.html` — Login
  - `trang_dashboard_t_i_l_n/code.html` — Dashboard / Analyze input
  - `trang_k_t_qu_xu_t/code.html` — Results
  - `trang_cv_t_i_u/code.html` — Refined CV preview
- **Priority:** P0 (Phase 03 is on critical path for Phase 06 demo)
- **Status:** pending
- **Depends on:** Phase 01 (Next.js scaffold)
- **Estimated effort:** 16–22 hours (revised — 4 full screens + shared module + layouts)
- **Scope decision:** Option A confirmed; **all 4 Stitch screens implemented**; History/Optimizations/Career Path = stub "Coming soon" using shared `EmptyState` inside `DashboardLayout`.

## Overview

Phase 03 ships the entire UI surface for ResumeRefine Phase 1: tokens, shared component library, layout templates, and 4 fully implemented Stitch screens. The phase is **architecture-first** — every visual primitive lives in a single shared module, every page composes from layout templates + shared UI. No page hardcodes a color, a spacing value, or a layout grid.

This file is the **index**. Detail lives in three sub-phase files:

| Sub-phase | File | Scope | Parallelizable |
|-----------|------|-------|----------------|
| 03a | [phase-03a-design-tokens-shared-ui.md](phase-03a-design-tokens-shared-ui.md) | Design tokens + Tailwind config + 16 shared UI components | Internally yes after 03.0 |
| 03b | [phase-03b-layout-templates.md](phase-03b-layout-templates.md) | 4 layout templates (Dashboard, Form, DetailPanel, Auth) | Blocks 03c |
| 03c | [phase-03c-feature-pages.md](phase-03c-feature-pages.md) | 4 screens (Login, Analyze, Results, Refined CV) + 3 stub tabs | Per-screen parallel |

## Hard UI/UX Contract (Mandatory — applies to every sub-phase)

These rules are **non-negotiable** and must be reflected in every PR:

1. **All visual values come from design tokens** — colors, typography, spacing, radius, shadows, layout sizes, status styles. No hardcoded values in feature pages.
2. **Use shared UI components first.** Mandated names: `Button`, `Input`, `Select`, `FormField`, `Card`, `Table`, `Modal`, `Drawer`, `Badge`, `Tabs`, `Pagination`, `EmptyState`, `LoadingState`, `ErrorState`, `PageHeader`.
3. **Use shared layout templates first.** Mandated names: `AdminPageLayout`, `ListPageLayout`, `FormPageLayout`, `DetailPanelLayout`, `DashboardLayout`.
4. **Missing component → create in shared UI module first** with defined props, variants, states, responsive behavior; then consume from feature page.
5. **Feature modules = business logic only.** API calls, validation, permission, data mapping, workflow state. No visual primitives.
6. **No duplicates.** No local color systems, no local spacing systems, no page-specific visual patterns that should be shared.
7. **No leaked prompt/AI residue.** No TODO comments, no `// TODO LLM:`, no debug labels, no fake helper text, no `console.log` left behind.
8. **Hints policy.** Short muted placeholders inside fields only. Labels stay clear and accessible. No unnecessary helper text.
9. **Global UI changes propagate via tokens / shared components / layout templates.** A token edit must change all 4 screens with zero per-page overrides.

## Mandated Component Decision (Phase 1 scope)

| Mandated Component | Phase 1 Status | Reason |
|--------------------|----------------|--------|
| `Button` | Implement | Used by all 4 screens |
| `Input` | Implement | Login email, JD URL, API key, etc. |
| `Select` | Implement | Role family, strictness, language, provider, model |
| `FormField` | Implement | Wraps label + control + error for all forms |
| `Card` | Implement | Score card, optimization paths, CV preview |
| `Table` | **Defer Phase 2** | No list views in Phase 1; reserve folder slot |
| `Modal` | Implement | Confirm dialogs, BYOK key entry confirm |
| `Drawer` | Implement | Mobile settings panel, mobile sidebar |
| `Badge` | Implement | Decision chip, ATS chips, status pills |
| `Tabs` | Implement | Results sub-sections (Optimization / Interview / etc.) |
| `Pagination` | **Defer Phase 2** | No paginated lists in Phase 1; reserve folder slot |
| `EmptyState` | Implement | Stub tabs "Coming soon", pre-analysis empty results |
| `LoadingState` | Implement | Analyze in-flight, scrape in-flight, parse in-flight |
| `ErrorState` | Implement | Analyze failures, scrape failures, quota exceeded |
| `PageHeader` | Implement | Title + subtitle + optional action slot on every page |

**Plus app-specific shared components** (live in same `src/components/ui/` module because they are reusable visual primitives — NOT in feature folders):

- `CircularProgress` — Match Score ring (SVG conic + numeric center)
- `Slider` — Analysis Parameter weight controls (0–100)
- `DropZone` — File upload region (CV + JD file upload share)
- `MarkdownView` — Refined CV preview + full markdown report

## Mandated Layout Decision (Phase 1 scope)

| Mandated Layout | Phase 1 Status | Used by |
|-----------------|----------------|---------|
| `AdminPageLayout` | **Defer Phase 2** | No admin surfaces in Phase 1 |
| `ListPageLayout` | **Defer Phase 2** | No list pages Phase 1 |
| `FormPageLayout` | Implement | Analyze input page (nested inside DashboardLayout) |
| `DetailPanelLayout` | Implement | Results + Refined CV (main + right aside) |
| `DashboardLayout` | Implement | All authed pages — sidebar + topnav shell |

**Extension (with justification):**

- `AuthLayout` — Login page. **Justified** because auth pages have a fundamentally different shell (no sidebar, no topnav, centered card on patterned background). Adding to shared layouts is correct per rule 3 ("create in shared module first"). Documented in `src/components/layouts/README.md` as an approved extension.

## Architecture (high-level)

```
src/
├── lib/
│   ├── design-tokens.ts            # Single source of truth for all visual values (re-exported into Tailwind)
│   ├── file-parsers.ts             # Business logic
│   └── api-client.ts               # Business logic
├── components/
│   ├── ui/                         # SHARED VISUAL PRIMITIVES (token-bound, no business logic)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── form-field.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── tabs.tsx
│   │   ├── modal.tsx
│   │   ├── drawer.tsx
│   │   ├── empty-state.tsx
│   │   ├── loading-state.tsx
│   │   ├── error-state.tsx
│   │   ├── page-header.tsx
│   │   ├── circular-progress.tsx
│   │   ├── slider.tsx
│   │   ├── drop-zone.tsx
│   │   ├── markdown-view.tsx
│   │   ├── index.ts                # Barrel export
│   │   └── README.md               # "Phase 2+ reserved: table, pagination"
│   └── layouts/                    # SHARED LAYOUT TEMPLATES (slot-based, no business logic)
│       ├── dashboard-layout.tsx
│       ├── form-page-layout.tsx
│       ├── detail-panel-layout.tsx
│       ├── auth-layout.tsx
│       ├── index.ts
│       └── README.md               # AuthLayout justification + Phase 2+ reserved templates
├── features/                       # BUSINESS LOGIC (compose shared UI + layouts)
│   ├── auth/
│   │   └── sign-in-form.tsx
│   ├── analyze/
│   │   ├── analyze-page.tsx        # Composes FormPageLayout + shared UI
│   │   ├── cv-input-block.tsx      # Wires DropZone + parser + store
│   │   ├── jd-input-block.tsx      # Wires textarea + URL scrape + char counter
│   │   ├── analysis-parameters-block.tsx  # Wires 3 Sliders + Badge preset
│   │   ├── settings-panel-block.tsx       # Provider/model/key controls
│   │   ├── settings-store.ts
│   │   ├── analysis-store.ts
│   │   ├── api-client.ts
│   │   └── types.ts
│   ├── results/
│   │   ├── results-page.tsx        # Composes DetailPanelLayout
│   │   ├── match-score-block.tsx   # CircularProgress + headline + Badge chips
│   │   ├── optimization-paths-block.tsx   # Card list
│   │   ├── keyword-coverage-block.tsx
│   │   └── recommendations-block.tsx
│   └── refined-cv/
│       ├── refined-cv-page.tsx
│       ├── refined-cv-view.tsx     # MarkdownView wrap
│       ├── key-enhancements-block.tsx
│       └── refine-tools-block.tsx
└── app/                            # Next.js routes — thin wrappers that call feature pages
    ├── (auth)/sign-in/page.tsx
    ├── (app)/layout.tsx            # Wraps with DashboardLayout
    ├── (app)/page.tsx              # Analyze
    ├── (app)/refined-cv/page.tsx
    ├── (app)/history/page.tsx      # Stub
    ├── (app)/optimizations/page.tsx # Stub
    └── (app)/career-path/page.tsx  # Stub
```

**File ownership for parallel work:**

- Owner A: tokens + shared UI base (`button`, `input`, `select`, `form-field`, `card`, `badge`, `tabs`, `page-header`)
- Owner B: shared UI overlays + states (`modal`, `drawer`, `empty-state`, `loading-state`, `error-state`) + app-specific (`circular-progress`, `slider`, `drop-zone`, `markdown-view`)
- Owner C: layouts (after A finishes base UI tokens)
- Owners A/B/C: feature pages (each takes 1–2 screens after C finishes layouts)

## Screen → Layout → Component Mapping

| Stitch screen | Route | Layout template(s) | Shared UI consumed | Feature business components |
|---------------|-------|--------------------|---------------------|------------------------------|
| Login (`trang_ng_nh_p`) | `/sign-in` | `AuthLayout` | `Card`, `Input`, `FormField`, `Button`, `Badge` | `SignInForm` |
| Analyze (`trang_dashboard_t_i_l_n`) | `/` | `DashboardLayout` > `FormPageLayout` | `PageHeader`, `Card`, `DropZone`, `Input`, `Select`, `Slider`, `Button`, `Badge`, `FormField`, `Modal`, `Drawer` (mobile settings) | `CvInputBlock`, `JdInputBlock`, `AnalysisParametersBlock`, `SettingsPanelBlock` |
| Results (`trang_k_t_qu_xu_t`) | `/` (inline panel) | `DashboardLayout` > `DetailPanelLayout` | `PageHeader`, `Card`, `CircularProgress`, `Badge`, `Tabs`, `LoadingState`, `EmptyState`, `ErrorState`, `Button` | `MatchScoreBlock`, `OptimizationPathsBlock`, `KeywordCoverageBlock`, `RecommendationsBlock` |
| Refined CV (`trang_cv_t_i_u`) | `/refined-cv` | `DashboardLayout` > `DetailPanelLayout` | `PageHeader`, `Card`, `MarkdownView`, `Button`, `CircularProgress`, `Badge` | `RefinedCvView`, `KeyEnhancementsBlock`, `RefineToolsBlock` |
| History (stub) | `/history` | `DashboardLayout` | `PageHeader`, `EmptyState` | (none — empty page) |
| Optimizations (stub) | `/optimizations` | `DashboardLayout` | `PageHeader`, `EmptyState` | (none) |
| Career Path (stub) | `/career-path` | `DashboardLayout` | `PageHeader`, `EmptyState` | (none) |

## Implementation Order

Strict ordering to maximize parallelism without blocking:

1. **03.0 Tokens** (blocking) — `design-tokens.ts` + `tailwind.config.ts`. Nothing else starts.
2. **03.1 Shared UI base** — Button, Input, Select, FormField, Card, Badge, Tabs, PageHeader.
3. **03.2 Shared UI states + overlays** — Modal, Drawer, EmptyState, LoadingState, ErrorState. Parallel with 03.1 after one dev completes Button + Card.
4. **03.3 App-specific shared UI** — CircularProgress, Slider, DropZone, MarkdownView. Parallel with 03.1/03.2.
5. **03.4 Layout templates** — DashboardLayout, FormPageLayout, DetailPanelLayout, AuthLayout. Starts when 03.1 base is merged.
6. **03.5 Login page** — Parallel after 03.4.
7. **03.6 Analyze page** — Parallel after 03.4.
8. **03.7 Results page** — Parallel after 03.4.
9. **03.8 Refined CV page** — Parallel after 03.4.
10. **03.9 Stub tabs** — Trivial, last.

Detail of each step is in 03a / 03b / 03c.

## Pre-Finalization Scan Checklist (apply at end of every sub-phase)

Every PR closing a sub-phase MUST verify (manual + script where possible):

- [ ] No hardcoded colors, spacing, typography, radius, shadows outside `tokens.ts` + `tailwind.config.ts`. (Grep: `bg-#`, `text-#`, inline `style=` colors, `px-[NNpx]` literals outside tokens.)
- [ ] No locally-redefined components duplicating shared UI. (Grep: `function Button`, `function Card`, etc. outside `components/ui/`.)
- [ ] No locally-redefined layout shells. (Grep: `<aside`, `<nav class="sidebar"` outside `components/layouts/`.)
- [ ] No leaked prompt text / AI comments / TODO / debug labels / fake helper text. (Grep: `TODO`, `FIXME`, `console.log`, `// AI`, `lorem`, `placeholder text`.)
- [ ] All helper text justifiable as user-facing value. (Manual review — every `<p>` near an input.)
- [ ] Placeholders short muted hints, never label substitutes. (Visual scan + ARIA-label check.)
- [ ] Global token change propagates to all 4 screens without per-page edits. (Smoke test: change `--color-secondary` value, verify Match Score ring + decision chip update everywhere.)
- [ ] Every feature page imports visual primitives only from `@/components/ui` and `@/components/layouts`. (Grep feature files for `className=".*bg-white rounded.*"` direct usage.)
- [ ] Each shared UI component file < 200 LOC.
- [ ] TypeScript strict — no `any`, no implicit any.
- [ ] React Server Components by default; `'use client'` only where state/interactivity needs.
- [ ] All shared components export typed props from `index.ts`.

## Constraints

- Component file < 200 LOC. Split sub-parts if needed.
- TypeScript strict; props typed; no `any`.
- RSC default; `'use client'` only when interactive (forms, sliders, modals, stores).
- Tailwind classes preferred; inline `style` only where Tailwind cannot express (conic-gradient for score ring is the documented exception).
- File naming: kebab-case (`button.tsx`, `form-field.tsx`, `circular-progress.tsx`, `dashboard-layout.tsx`).

## Success Criteria (phase-level)

- All 4 Stitch screens render at parity with mockups (visual diff acceptable < 5%).
- Sidebar layout (DashboardLayout) renders identically across Analyze, Results, Refined CV, and 3 stub tabs.
- Stub tabs (History, Optimizations, Career Path) display `EmptyState` with "Coming soon — Phase 2" message; no broken nav.
- Token edit test: change `colors.secondary` in `tokens.ts` → Match Score ring fill + decision-success chips + "Generate Matched CV" CTA glow all update without touching any feature file.
- Settings panel (BYOK vs shared toggle) wired to `settings-store`, BYOK field only persists when "Remember key" checked.
- Click "Analyze & Score" → calls `/api/analyze` (returns 404 until Phase 06 — acceptable).
- `pnpm tsc --noEmit` clean.
- `pnpm build` clean.
- `pnpm lint` clean.
- Pre-Finalization Scan Checklist green for each sub-phase.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Token leak — devs hardcode color in feature page | High | High | Pre-Finalization Scan grep blocks PR merge; CI lint rule `no-restricted-syntax` for hex literals outside `lib/design-tokens.ts` |
| Shared UI bloat past 200 LOC | Med | Med | Split into sub-components; example: `Modal` → `modal.tsx` (shell) + `modal-header.tsx` + `modal-footer.tsx` |
| Conic-gradient (score ring) breaks Tailwind purge | Low | Med | Use inline `style` for the gradient stop; document as approved exception in `circular-progress.tsx` |
| RSC/Client split mistakes (Zustand in RSC) | Med | Med | All store imports gated by `'use client'`; barrel exports separate `ui/index.ts` (RSC-safe) vs `ui/client.ts` (interactive) |
| Auth pages get partial sidebar by mistake | Low | High | `AuthLayout` deliberately omits sidebar; `(auth)` route group has no shared layout shell |
| Parallel work file collisions | Med | Med | Owner table above is binding; one component = one owner; `index.ts` barrel updates serialized via merge order |
| Stitch design drift (mockups already inconsistent — Refined CV has "Download PDF" but Phase 1 has no PDF) | Med | Low | Replace "Download PDF" button with "Download Markdown" + "Download HTML" per brainstorm; document drift in feature page header comment |

## Backwards Compatibility / Migration

- No existing users yet (Phase 1 first release). No migration path needed.
- Future Phase 2 additions (Table, Pagination, AdminPageLayout, ListPageLayout) slot into the same `components/ui/` and `components/layouts/` directories without restructure. Phase 2 README hints in both folders.
- BYOK-stored API key migration: `settings-store` versioned (`cv-ex-settings-v1`); breaking schema change requires `migrate()` in Zustand persist config.

## Rollback Plan

Each sub-phase ships behind a feature-folder boundary. Rollback per sub-phase:

- **03a rollback** — revert `lib/design-tokens.ts`, `tailwind.config.ts`, `components/ui/*`. All feature pages break (expected). Rebase or restore commit.
- **03b rollback** — revert `components/layouts/*`. Feature pages crash on import. Restore commit; sub-phase 03c blocked until 03b restored.
- **03c rollback (per page)** — revert specific `features/{name}/` + `app/.../page.tsx`. Other pages unaffected because each feature folder is isolated.

## Security Considerations

- BYOK key in `settings-store` persisted to localStorage **only** when `rememberKey === true` (Zustand `partialize`).
- Shared-key request body must omit `apiKey` field — enforced by `api-client.ts` request builder + Zod schema.
- File upload size pre-check client-side (`< 4.5MB`) before any network call.
- No PII (CV/JD content) sent to analytics; no analytics SDK in Phase 1 anyway.
- No leaked prompt strings in client bundle — prompts live server-side only (Phase 06).

## Test Matrix

| Test type | Target | When |
|-----------|--------|------|
| Unit (shared UI) | Each component renders all variants/states | Sub-phase 03a/03b done |
| Unit (stores) | settings-store persist + clear; analysis-store transitions | Sub-phase 03c (analyze feature) done |
| Integration | Feature page composes correct layout + shared UI | Sub-phase 03c per page |
| Visual diff | Each screen vs Stitch mockup screenshot | End of 03c |
| Token-propagation smoke | Change `tokens.colors.secondary` → grep screenshots for old color | End of 03c |
| Build | `pnpm build` clean | End of every sub-phase |
| TS strict | `pnpm tsc --noEmit` clean | Per commit |

## Next Steps

- Phase 04 (parse API) + Phase 05 (scrape API) unblock CV/JD upload + URL scrape buttons.
- Phase 06 (LLM endpoints) makes "Analyze & Score" return real data.
- Phase 07 (quota) wires quota counter into `Badge` in topnav of `DashboardLayout`.
- Phase 08 (i18n) wraps every user-facing string in `t(...)` — Phase 03 ships English strings inline; i18n migration is a string-replace pass, not a structural change.

## Resolved Decisions (locked 2026-05-26)

These decisions are locked. Sub-phase work proceeds against these.

1. **Predictive Interview Questions** — render single `EmptyState` card titled "Predictive Interview Questions — Phase 2" inside the Results `Tabs` sub-section. No LLM call.
2. **Pro CTA sidebar block** — **hide entirely** in Phase 1. `DashboardLayout` exposes optional `proCtaSlot?: ReactNode` prop reserved for Phase 2. No placeholder rendered.
3. **"Enter as Guest" link on Login** — render link, routes to `/?mode=byok`. The Analyze page reads `searchParams.mode` and opens `SettingsPanelBlock` pre-expanded to BYOK section. No separate guest route.
4. **Refined CV downloads** — `.md` and `.html` only. No `.pdf` button rendered. Stitch "Download PDF" copy replaced.
5. **"Generate Cover Letter" Pro Tip card** — **hide entirely** in Phase 1. No placeholder.
6. **`Select` library** — native `<select>` wrapped in our styled `Select` shared component. No headless-ui / Radix Select Phase 1. KISS.
7. **`Modal` + `Drawer` library** — Radix UI primitives (`@radix-ui/react-dialog`) wrapped in our `Modal`/`Drawer` shared components. Smaller bundle than headless-ui for these specific needs.
8. **Results layout** — render inline below the Analyze form (same `/` route) when `analysisStore.result !== null`. No separate `/results` route. Matches Stitch single-page flow + KISS.
9. **Refined CV diff highlighting** — out of scope Phase 1. `MarkdownView` renders plain markdown only. No added-segment highlighting.

## Tailwind Version Note

Phase 01 scaffold produced **Tailwind v4** (Next.js 15 default). Tokens live in `src/app/globals.css` `@theme` block (CSS-first config), not `tailwind.config.ts` `theme.extend`. The `design-tokens.ts` file mirrors the same values for TypeScript runtime consumption (e.g., conic-gradient stops). See 03a sub-phase for details.
