# Phase 03b — Layout Templates

> Parent: [phase-03-ui-port.md](phase-03-ui-port.md)
> Depends on: [phase-03a-design-tokens-shared-ui.md](phase-03a-design-tokens-shared-ui.md) (base UI components)
> Hard UI/UX contract applies — read parent first.

## Overview

Build the **4 layout templates** every Phase 1 screen composes from. No feature work. No standalone visual primitives — all visuals come from `src/components/ui/`. Output: `src/components/layouts/*`.

**Priority:** P0 (blocks 03c feature pages)
**Status:** pending
**Estimated effort:** 3–4 hours
**File ownership:** Owner C (single owner — layouts share concepts)

## Key Insights

- All 3 Stitch authed screens (Analyze / Results / Refined CV) share the same sidebar + topnav shell. That shell is `DashboardLayout`.
- The Analyze screen's *interior* is form-shaped (sections + sticky CTA at bottom) → `FormPageLayout` nests inside `DashboardLayout`.
- Results + Refined CV interiors are *main + right rail* shape → `DetailPanelLayout` nests inside `DashboardLayout`.
- Login is a completely different shell → `AuthLayout`, sibling not child of DashboardLayout.

## Layout Templates

### `dashboard-layout.tsx`

The persistent shell for every authed page.

**Props:**
```ts
type DashboardLayoutProps = {
  activeNav: 'analyze' | 'history' | 'optimizations' | 'career-path';
  topnavTitle?: string;          // e.g., "Analyze" or "Profile"
  topnavActions?: ReactNode;     // optional buttons next to bell/avatar
  proCtaSlot?: ReactNode;        // Phase 1: hidden; Phase 2 inject upgrade card
  children: ReactNode;
};
```

**Slots / structure:**
```
+-------------------------------------------------------------+
| [Sidebar 256px]      | [Topnav 80px        ]               |
| - Logo               +--------------------------------------+
| - Nav (4 items)      | [main slot]                          |
| - {proCtaSlot}       |                                      |
| - Help / Logout      |                                      |
+-------------------------------------------------------------+
```

**Token bindings:**
- Sidebar: `w-[--sidebar-width] bg-surface-container-low border-r border-outline-variant`
- Topnav: `h-[--topnav-height] bg-surface shadow-soft px-margin-desktop`
- Active nav item: `bg-tertiary-fixed text-on-tertiary-fixed font-bold rounded-lg`
- Inactive nav item: `text-on-surface-variant hover:bg-surface-container-high rounded-lg`

**Responsive:**
- Desktop ≥ 768px: sidebar visible.
- Mobile < 768px: sidebar hidden; hamburger button opens `Drawer` (from shared UI). Bottom nav (4-tab analytics/history/optimize/profile) appears.

**Shared UI consumed:** `Drawer` (mobile sidebar), `Button` (Pro CTA, hamburger).

**Note:** the Stitch Pro CTA card sits as a default slot fill **only if `proCtaSlot` prop provided**. Phase 1 passes `undefined` → slot empty.

**`'use client'`** required (mobile drawer state, active highlight via usePathname).

### `form-page-layout.tsx`

Used inside `DashboardLayout` for form-shaped pages. Phase 1: Analyze.

**Props:**
```ts
type FormPageLayoutProps = {
  header: ReactNode;            // typically a <PageHeader />
  sections: ReactNode;          // form blocks stacked
  stickyAction?: ReactNode;     // bottom action bar (e.g., "Analyze & Score" CTA)
  meta?: ReactNode;             // small note under CTA, e.g., "Est. 4-6 seconds"
};
```

**Structure:**
```
[header]
[section 1]
[section 2]
...
[section N]
[stickyAction (sticky bottom on mobile, inline on desktop)]
[meta]
```

**Spacing:** vertical stack `space-y-gutter` (24px) between sections; `pb-16` bottom to avoid CTA overlap with mobile nav.

**Container:** `max-w-container-max mx-auto p-margin-desktop` (40px) on desktop, `p-margin-mobile` (16px) on mobile.

**RSC-safe** (pure composition).

### `detail-panel-layout.tsx`

Used inside `DashboardLayout` for `main content + right rail` pages. Phase 1: Results, Refined CV.

**Props:**
```ts
type DetailPanelLayoutProps = {
  header: ReactNode;            // typically a <PageHeader /> with back link
  main: ReactNode;              // primary content (8 cols desktop)
  aside: ReactNode;             // right rail (4 cols desktop)
  asideSide?: 'right';          // future-proof; Phase 1 right only
};
```

**Structure (desktop ≥ xl):**
```
[header full-width]
[main col-span-8]   [aside col-span-4]
```

**Mobile (< xl):**
```
[header]
[main]
[aside]   <- stacked below main
```

**Grid:** `grid grid-cols-1 xl:grid-cols-12 gap-8 items-start`
**Container:** `max-w-container-max mx-auto p-margin-desktop`

**RSC-safe.**

### `auth-layout.tsx`

Used by Login (and any future auth flow: forgot-password, magic link).

**Justification for extension** (the mandated 5 layouts don't include an auth shell): auth pages have a fundamentally different chrome — no sidebar, no topnav, centered card on patterned background. Force-fitting `DashboardLayout` would require disabling its core slots, which is anti-pattern. Documented in `src/components/layouts/README.md`.

**Props:**
```ts
type AuthLayoutProps = {
  children: ReactNode;          // the auth card (typically a <Card>)
  footerLinks?: ReactNode;      // optional ToS/Privacy footer
};
```

**Structure:**
```
[bg-pattern fixed full-screen]
[atmospheric blur shapes (decorative)]
  [centered card max-w-[--auth-card-max-width]]
[footer (optional)]
```

**Token bindings:**
- Background: `bg-pattern bg-surface` with radial-gradient dot pattern (token: `--pattern-dot-color: var(--color-outline-variant)`)
- Atmospheric shapes: `absolute` blur layers using `bg-tertiary-fixed opacity-20 blur-[120px]`

**RSC-safe** (no interactivity in the shell itself).

### `index.ts` (barrel)

```ts
export { DashboardLayout } from './dashboard-layout';
export { FormPageLayout } from './form-page-layout';
export { DetailPanelLayout } from './detail-panel-layout';
export { AuthLayout } from './auth-layout';

// Phase 2+ reserved: AdminPageLayout, ListPageLayout
```

### `README.md` in `src/components/layouts/`

```
# Shared Layout Templates

## Phase 1 layouts
- DashboardLayout — sidebar + topnav shell; all authed pages
- FormPageLayout  — nests inside DashboardLayout; form-shaped pages (Analyze)
- DetailPanelLayout — nests inside DashboardLayout; main + right rail (Results, Refined CV)
- AuthLayout — centered card on patterned bg; Login

## Approved extensions
- AuthLayout: not in the 5 mandated layouts (AdminPageLayout / ListPageLayout / FormPageLayout / DetailPanelLayout / DashboardLayout)
  but auth pages need a fundamentally different shell — no sidebar, no topnav.
  Force-fitting DashboardLayout would require disabling all its slots = anti-pattern.

## Phase 2+ reserved
- AdminPageLayout
- ListPageLayout

## Rule
No feature page declares its own grid / sidebar / topnav / centered-card layout.
If a new shape is needed, add a template here first.
```

## Composition Examples

These examples show how feature pages will consume layouts. (Implementation lives in 03c; here only structural illustration.)

### Analyze page (03c — feature)
```tsx
<DashboardLayout activeNav="analyze" topnavTitle="Analyze">
  <FormPageLayout
    header={<PageHeader title="Match your profile to your dream role" subtitle="..." />}
    sections={
      <>
        <CvInputBlock />
        <JdInputBlock />
        <AnalysisParametersBlock />
        <SettingsPanelBlock />
      </>
    }
    stickyAction={<Button variant="primary" size="lg">Analyze & Score</Button>}
    meta={<p>Estimated processing time: 4–6 seconds</p>}
  />
</DashboardLayout>
```

### Results page (03c — feature)
```tsx
<DashboardLayout activeNav="analyze" topnavTitle="Results">
  <DetailPanelLayout
    header={<PageHeader title="Analysis Results" />}
    main={
      <>
        <MatchScoreBlock />
        <OptimizationPathsBlock />
      </>
    }
    aside={
      <>
        <KeywordCoverageBlock />
        <RecommendationsBlock />
      </>
    }
  />
</DashboardLayout>
```

### Login (03c — feature)
```tsx
<AuthLayout>
  <Card padding="lg">
    <SignInForm />
  </Card>
</AuthLayout>
```

## Implementation Steps (03b)

1. Create `src/components/layouts/dashboard-layout.tsx` — sidebar + topnav + main slot + mobile Drawer wiring.
2. Create `src/components/layouts/form-page-layout.tsx` — composition shell, no interactivity.
3. Create `src/components/layouts/detail-panel-layout.tsx` — 12-col grid, stacked on mobile.
4. Create `src/components/layouts/auth-layout.tsx` — patterned bg, centered card slot.
5. Create `src/components/layouts/index.ts` barrel.
6. Create `src/components/layouts/README.md` documenting extensions + reserved slots.
7. Visual smoke check: a placeholder route per layout to verify rendering and responsive breakpoints.

## Todo List

- [ ] `dashboard-layout.tsx` — sidebar nav (4 items + Help + Logout), topnav (title + actions + bell + avatar), mobile Drawer + bottom nav
- [ ] `form-page-layout.tsx` — header + sections stack + sticky action + meta
- [ ] `detail-panel-layout.tsx` — 12-col grid main(8) + aside(4); stacks on mobile
- [ ] `auth-layout.tsx` — bg-pattern + atmospheric shapes + centered card
- [ ] `index.ts` barrel
- [ ] `README.md` documents AuthLayout justification + Phase 2+ reserved
- [ ] All files < 200 LOC
- [ ] No hardcoded color/spacing/radius — all from Tailwind utility tokens
- [ ] Mobile Drawer wired via shared `Drawer` component (not redeclared)
- [ ] `'use client'` only where required (DashboardLayout for mobile state + active highlight)
- [ ] `pnpm tsc --noEmit` clean
- [ ] `pnpm build` clean

## Success Criteria

- All 4 layouts render at a dev placeholder route, each shows correct breakpoints (desktop / tablet / mobile).
- `DashboardLayout` highlights the correct nav item based on `activeNav` prop.
- `DashboardLayout` mobile Drawer opens/closes via hamburger; Drawer comes from shared UI (no redeclaration).
- `FormPageLayout` sticky action stays visible on mobile scroll; collapses to inline on desktop.
- `DetailPanelLayout` aside stacks under main on mobile (<xl), sits beside main on desktop (≥xl).
- `AuthLayout` shows the radial-dot pattern + atmospheric blur shapes from Stitch Login mockup.
- No layout file redeclares a `<div className="bg-white rounded-lg ...">` chrome that should be a `Card`.
- All files < 200 LOC.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Pro CTA slot tempts devs to hardcode Phase 2 marketing | Low | Med | `proCtaSlot` defaults to `undefined`; README states "Phase 1: do not pass" |
| `DashboardLayout` becomes a god-component (sidebar + topnav + drawer + bottom nav) | Med | Med | Extract `<DashboardSidebar />`, `<DashboardTopnav />`, `<DashboardMobileNav />` as private sub-components inside same file; keep public API single |
| Stitch sidebar uses different active item on Refined CV (highlights "Analyze" still — flow continues) | Low | Low | Document: `activeNav="analyze"` for Refined CV too, since it's part of the analyze flow |
| Responsive breakpoint mismatch between layouts (one uses `md`, another `xl`) | Med | Med | Single breakpoint constant in tokens: `tokens.layout.breakpoints` — but Tailwind defaults are fine; document chosen breakpoint per layout in README |
| AuthLayout's atmospheric blur shapes leak past viewport on small screens | Med | Low | `overflow-hidden` on outer wrapper; verify via mobile smoke test |

## Backwards Compatibility / Migration

- No existing layouts. Phase 2 additions (AdminPageLayout, ListPageLayout) extend the same `components/layouts/` folder.
- If a layout API breaks in Phase 2, search-and-replace across feature pages (each layout consumed in ≤ 4 places Phase 1).

## Security Considerations

- `DashboardLayout` avatar/profile data: render only from session (passed by Next.js layout via props); never read from client-only sources.
- Logout link in sidebar uses POST to `/api/auth/signout` (CSRF-safe via Auth.js v5).
- No client-side logging of nav state.

## Rollback Plan

- Each layout file is independent. Revert any one without cascading damage to others.
- If `DashboardLayout` ships broken, feature pages crash on import → rollback that file only. AuthLayout / FormPageLayout / DetailPanelLayout unaffected.

## Test Matrix

| Test | Target |
|------|--------|
| Unit | Each layout renders with required props |
| Unit | `DashboardLayout` mobile Drawer opens on hamburger click |
| Unit | `DashboardLayout` highlights correct nav item per `activeNav` |
| Visual | Each layout matches Stitch mockup at desktop + mobile |
| RSC | `FormPageLayout`, `DetailPanelLayout`, `AuthLayout` render without `'use client'` |

## Next Steps

- Sub-phase 03c builds 4 feature pages composing these 4 layouts + shared UI.

## Unresolved Questions

- `DashboardLayout` exposes `topnavActions` slot — Phase 1 will populate with quota counter `Badge` (after Phase 07). Phase 1 default: empty. Confirm OK.
- `DashboardLayout` Pro CTA: confirmed hidden Phase 1 (parent plan unresolved Q2).
- Should `AuthLayout` accept a `variant` prop for future flows (forgot-password) or always render the same shell? **Proposed: single shell; variants come from card contents.**
