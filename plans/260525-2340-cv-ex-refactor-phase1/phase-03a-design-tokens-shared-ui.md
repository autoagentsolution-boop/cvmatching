# Phase 03a — Design Tokens + Shared UI Module

> Parent: [phase-03-ui-port.md](phase-03-ui-port.md)
> Hard UI/UX contract applies — read parent first.

## Overview

Build the **single source of truth** for visual values and the **16 shared UI components** every Phase 1 screen consumes. No feature work in this sub-phase. Output: `src/lib/design-tokens.ts`, `tailwind.config.ts` extensions, `src/components/ui/*`.

**Priority:** P0 (blocks 03b + 03c)
**Status:** pending
**Estimated effort:** 6–8 hours
**File ownership:** Owner A (tokens + base components), Owner B (states + overlays + app-specific)

## Key Insights

- Stitch DESIGN.md uses Material 3-style token names (`surface-container-low`, `on-tertiary-container`, etc.). Mirror these exactly in `tokens.ts` so devs can translate Stitch mockup classes 1:1.
- Stitch Tailwind config in each `code.html` already maps the token names to Tailwind utilities. Port that block to our `tailwind.config.ts`.
- "Soft UI" shadow (`0 20px 20px -5px rgba(15, 23, 42, 0.08)`) appears in every screen. Token it as `shadow.soft`.
- Score ring (`progress-ring-circle`) and Slider (`accent-on-tertiary-container`) are the only Tailwind-edge cases.

## Section A — Design Tokens

### File: `src/lib/design-tokens.ts`

Single source of truth. All other styling derives from this file.

**Token categories:**

```ts
export const tokens = {
  colors: {
    // Surface scale
    surface: '#f7f9fb',
    surfaceDim: '#d8dadc',
    surfaceBright: '#f7f9fb',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f2f4f6',
    surfaceContainer: '#eceef0',
    surfaceContainerHigh: '#e6e8ea',
    surfaceContainerHighest: '#e0e3e5',
    onSurface: '#191c1e',
    onSurfaceVariant: '#45464d',
    inverseSurface: '#2d3133',
    inverseOnSurface: '#eff1f3',

    // Outline
    outline: '#76777d',
    outlineVariant: '#c6c6cd',

    // Primary (Deep Navy in brand voice, black in tokens)
    primary: '#000000',
    onPrimary: '#ffffff',
    primaryContainer: '#131b2e',
    onPrimaryContainer: '#7c839b',
    primaryFixed: '#dae2fd',
    primaryFixedDim: '#bec6e0',
    onPrimaryFixed: '#131b2e',
    onPrimaryFixedVariant: '#3f465c',
    inversePrimary: '#bec6e0',

    // Secondary (Success Green)
    secondary: '#006e2f',
    onSecondary: '#ffffff',
    secondaryContainer: '#6bff8f',
    onSecondaryContainer: '#007432',
    secondaryFixed: '#6bff8f',
    secondaryFixedDim: '#4ae176',
    onSecondaryFixed: '#002109',
    onSecondaryFixedVariant: '#005321',

    // Tertiary (Action Blue)
    tertiary: '#000000',
    onTertiary: '#ffffff',
    tertiaryContainer: '#001a42',
    onTertiaryContainer: '#3980f4',
    tertiaryFixed: '#d8e2ff',
    tertiaryFixedDim: '#adc6ff',
    onTertiaryFixed: '#001a42',
    onTertiaryFixedVariant: '#004395',

    // Error
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#93000a',

    // Background
    background: '#f7f9fb',
    onBackground: '#191c1e',
    surfaceVariant: '#e0e3e5',
    surfaceTint: '#565e74',
  },

  typography: {
    displayLg: { family: 'Plus Jakarta Sans', size: '48px', weight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
    headlineLg: { family: 'Plus Jakarta Sans', size: '32px', weight: 700, lineHeight: 1.25, letterSpacing: '-0.01em' },
    headlineLgMobile: { family: 'Plus Jakarta Sans', size: '24px', weight: 700, lineHeight: 1.3 },
    headlineMd: { family: 'Plus Jakarta Sans', size: '24px', weight: 600, lineHeight: 1.4 },
    bodyLg: { family: 'Inter', size: '18px', weight: 400, lineHeight: 1.6 },
    bodyMd: { family: 'Inter', size: '16px', weight: 400, lineHeight: 1.6 },
    labelMd: { family: 'Inter', size: '14px', weight: 500, lineHeight: 1.4, letterSpacing: '0.01em' },
    labelSm: { family: 'Inter', size: '12px', weight: 600, lineHeight: 1.4, letterSpacing: '0.03em' },
  },

  spacing: {
    base: '8px',
    gutter: '24px',
    sectionGap: '80px',
    marginMobile: '16px',
    marginDesktop: '40px',
    containerMax: '1280px',
  },

  radius: {
    sm: '0.25rem',
    DEFAULT: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },

  shadow: {
    soft: '0 20px 20px -5px rgba(15, 23, 42, 0.08)',
    softLg: '0 20px 40px -15px rgba(15, 23, 42, 0.06)',
  },

  layout: {
    sidebarWidth: '256px',
    topnavHeight: '80px',
    authCardMaxWidth: '480px',
  },

  // Status — derived from base colors. Use for Badge, ErrorState, LoadingState, etc.
  status: {
    success: { bg: 'var(--color-secondary-container)', fg: 'var(--color-on-secondary-container)' },
    warning: { bg: 'var(--color-tertiary-fixed)', fg: 'var(--color-on-tertiary-fixed)' }, // re-used for "info-warn"
    error: { bg: 'var(--color-error-container)', fg: 'var(--color-on-error-container)' },
    info: { bg: 'var(--color-tertiary-fixed)', fg: 'var(--color-on-tertiary-fixed-variant)' },
    neutral: { bg: 'var(--color-surface-container-high)', fg: 'var(--color-on-surface-variant)' },
  },
} as const;

export type Tokens = typeof tokens;
```

### Tailwind v4 reality (Phase 01 outcome)

Phase 01 scaffold produced **Tailwind v4** (default in Next.js 15). Tailwind v4 uses **CSS-first configuration** via the `@theme` directive in `src/app/globals.css` — NOT `theme.extend` in `tailwind.config.ts`. The token source-of-truth split is therefore:

| File | Role |
|------|------|
| `src/app/globals.css` (`@theme` block) | **Runtime source of truth** for Tailwind utilities. Phase 01 already populated full Stitch palette + typography + radius + spacing + shadows. Editing a value here propagates to every utility class app-wide. |
| `src/lib/design-tokens.ts` | **TypeScript source of truth** — re-exports the same values as typed constants. Only consumed by TS code that needs raw token values at runtime (e.g., the `CircularProgress` conic-gradient stop where Tailwind cannot express). Must stay in sync with `globals.css` — enforce via a single visual contract test. |
| `tailwind.config.ts` | **Content paths only** (`content: ['./src/**/*.{ts,tsx}']`). No `theme.extend`. Phase 01 already created this. |

**Implication:** `design-tokens.ts` is no longer the authoritative input to Tailwind. It is a mirror for TS-side consumption. To prevent drift, ship a unit test that reads `@theme` block + `tokens` and asserts they match (or generate `tokens` from `@theme` via a small build step — defer that to Phase 2 unless drift becomes a real problem).

### File: `src/app/globals.css` (already exists — verify, do not duplicate work)

Phase 01 already wrote the full `@theme` block. Verify all token categories present:

- Colors — full Stitch palette (surface/primary/secondary/tertiary/error families)
- Typography — `--font-inter`, `--font-jakarta` plus font-size scales
- Radius — `sm/DEFAULT/md/lg/xl/full`
- Spacing — `gutter/margin-mobile/margin-desktop/section-gap`
- Shadow — `soft`, `ghost-border`
- maxWidth — `container`

If any token is missing for Phase 1 needs, add to `@theme` block and mirror in `design-tokens.ts`. Do not introduce a parallel token system.

### File: `tailwind.config.ts` (already exists — do not modify unless adding content paths)

Phase 01 created a minimal `tailwind.config.ts` declaring `content` paths. Tailwind v4 reads tokens from `@theme` in CSS, not from this file. **Do not add `theme.extend`** — it will be ignored and create maintenance debt.

**Rule:** Phase 1 changes to a token MUST propagate to all 4 screens with zero per-page overrides. CI test: grep for hex literals (`#[0-9a-fA-F]{3,8}`) outside `globals.css` + `design-tokens.ts` + the documented conic-gradient exception in `circular-progress.tsx`.

## Section B — Shared UI Components

All files live in `src/components/ui/`. Each component:

- File < 200 LOC.
- Props typed; no `any`.
- RSC-compatible unless explicitly noted as `'use client'`.
- Consumes design tokens via Tailwind utilities. No inline `style` except documented exceptions.

### `button.tsx`

**Props:**
```ts
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  children: ReactNode;
};
```
**Variants (token bindings):**
- `primary` → `bg-primary text-on-primary shadow-soft`
- `secondary` → `bg-surface-container-lowest text-on-surface border border-outline-variant`
- `ghost` → `bg-transparent text-on-surface hover:bg-surface-container-low`
- `destructive` → `bg-error text-on-error`
**Sizes (token bindings):** `sm h-9 px-4`, `md h-12 px-6`, `lg h-14 px-8`
**States:** default, hover (opacity-90 / bg shift), focus (ring-4 ring-on-tertiary-container/10), active (scale-[0.98]), disabled (opacity-50 cursor-not-allowed), loading (spinner replaces leadingIcon, disables clicks)
**`'use client'`** required for onClick + loading spinner state.

### `input.tsx`

**Props:** `type` (text/email/password/number), `value`, `onChange`, `placeholder`, `leadingIcon`, `trailingIcon`, `error` (boolean), `disabled`, `id`, `name`, `autoComplete`, `inputMode`.
**Visual:** `h-12 px-4 rounded-lg border border-outline-variant focus:border-on-tertiary-container focus:ring-4 focus:ring-on-tertiary-container/10 bg-surface-container-lowest`
**Error state:** border-error focus:ring-error/10
**`'use client'`** because onChange.

### `select.tsx`

**Props:** `options: { value: string; label: string }[]`, `value`, `onChange`, `placeholder`, `disabled`, `error`.
**Visual:** matches `Input` height/border/focus tokens for visual consistency.
**`'use client'`**.
**Decision:** native `<select>` for Phase 1 (KISS). No custom dropdown. Phase 2 can swap to headless-ui combobox.

### `form-field.tsx`

**Props:** `label`, `htmlFor`, `error` (string | undefined), `helperText` (string | undefined — **use sparingly per UI contract rule 8**), `required`, `children` (the control).
**Layout:** label above control, error below (red text-error-container), helperText below (muted on-surface-variant).
**RSC-safe** (no state).

### `card.tsx`

**Props:** `variant?: 'default' | 'interactive' | 'inverse'`, `padding?: 'sm' | 'md' | 'lg'`, `as?: ElementType`, `children`.
**Variants:**
- `default` → `bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-soft`
- `interactive` → adds `hover:shadow-soft-lg hover:translate-y-[-2px] transition-all cursor-pointer`
- `inverse` → `bg-primary-container text-on-primary` (for "Ready to Apply?" CTA card on Results)
**Padding:** sm = p-4, md = p-6, lg = p-10
**RSC-safe.**

### `badge.tsx`

**Props:** `variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'`, `size?: 'sm' | 'md'`, `children`.
**Variants bound to `tokens.status.*`:**
- success → `bg-secondary-fixed text-on-secondary-fixed`
- warning → `bg-tertiary-fixed text-on-tertiary-fixed`
- error → `bg-error-container text-on-error-container`
- info → `bg-tertiary-fixed text-on-tertiary-fixed-variant`
- neutral → `bg-surface-container-highest text-on-surface-variant`
**Shape:** pill (`rounded-full px-3 py-1 text-xs font-bold`)
**RSC-safe.**

### `tabs.tsx`

**Props:** `tabs: { id: string; label: string; disabled?: boolean }[]`, `activeId`, `onChange`, `variant?: 'underline' | 'pills'`.
**`'use client'`** (interactive).
**Token bindings:** active = `text-on-tertiary-container border-b-2 border-on-tertiary-container`; inactive = `text-on-surface-variant hover:text-primary`.

### `modal.tsx`

**Props:** `open`, `onClose`, `title`, `size?: 'sm' | 'md' | 'lg'`, `dismissOnBackdrop?: boolean`, `children`.
**Behavior:** focus trap, ESC closes, backdrop dismissable opt-in.
**Visual:** `bg-surface-container-lowest rounded-xl shadow-soft-lg p-8 max-w-md` (size sm)
**`'use client'`.**
**Library decision:** `@radix-ui/react-dialog` for accessibility primitives; styling all token-bound.

### `drawer.tsx`

**Props:** `open`, `onClose`, `side?: 'right' | 'bottom'`, `title`, `children`.
**Use cases Phase 1:** mobile sidebar nav, mobile settings panel.
**Visual:** slides from side, `bg-surface-container-lowest border-l border-outline-variant`.
**`'use client'`.** Built on `@radix-ui/react-dialog` with side variant.

### `empty-state.tsx`

**Props:** `icon?: ReactNode`, `title`, `description?: string`, `action?: ReactNode` (typically a `Button`).
**Visual:** centered, `py-16` vertical space, muted text, icon in `bg-surface-container-high w-16 h-16 rounded-2xl`.
**RSC-safe.**

### `loading-state.tsx`

**Props:** `variant?: 'spinner' | 'skeleton'`, `message?: string`, `lines?: number` (for skeleton).
**Spinner variant:** centered with optional `message`.
**Skeleton variant:** renders N pulse blocks (`bg-surface-container-high animate-pulse rounded`).
**RSC-safe** (CSS animation, no JS state).

### `error-state.tsx`

**Props:** `title`, `description?: string`, `retry?: () => void`, `icon?: ReactNode`.
**Visual:** uses `tokens.status.error` colors; `Card` with error tone.
**`'use client'`** when `retry` provided (onClick).

### `page-header.tsx`

**Props:** `title`, `subtitle?: string`, `action?: ReactNode`, `breadcrumb?: ReactNode`.
**Visual:**
- title → `font-display-lg text-display-lg text-primary tracking-tight` (or `headline-lg` mobile)
- subtitle → `font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-2xl`
- action slot right-aligned on desktop, stacked on mobile
**RSC-safe.**

### `circular-progress.tsx`

**Props:** `value` (0–100), `size?: number` (default 192), `strokeWidth?: number` (default 8), `label?: string`, `valueFormat?: (v: number) => string`.
**Implementation:**
- SVG circle: track in `text-surface-container-low`, fill in `text-secondary` (token).
- `stroke-dasharray = 2πr`; `stroke-dashoffset = circumference * (1 - value/100)`.
- Center: numeric value (display-lg) + label (label-md).
**Documented exception:** the only stroke-dashoffset computation lives here. No other component uses raw SVG attribute calculation.
**RSC-safe** (pure props → SVG).

### `slider.tsx`

**Props:** `value`, `onChange`, `min?` (default 0), `max?` (default 100), `step?` (default 1), `disabled`, `aria-label`.
**Visual:** `<input type="range">` styled per Stitch: `accent-on-tertiary-container h-2 bg-surface-container-highest rounded-lg`.
**`'use client'`** (controlled input).

### `drop-zone.tsx`

**Props:** `onFile: (file: File) => void`, `accept?: string` (e.g., `'.pdf,.docx,.txt'`), `maxSizeMb?: number` (default 4.5), `title`, `subtitle`, `disabled`.
**Visual:** `border-2 border-dashed border-outline-variant hover:border-on-tertiary-container bg-white rounded-3xl p-12 shadow-soft`.
**Drag states:** `dragenter`/`dragover` → `border-on-tertiary-container bg-tertiary-fixed`.
**`'use client'`** (drag event handlers + state).
**Validates** size + extension client-side; emits `onError` callback for size/type fail.

### `markdown-view.tsx`

**Props:** `markdown: string`, `variant?: 'document' | 'compact'`.
**Implementation:** `react-markdown` + `remark-gfm` for tables/lists. Styled headings via Tailwind prose-like overrides bound to tokens (no `@tailwindcss/typography` plugin — manual minimal CSS to keep dependency surface small).
**`'use client'`** if interactive (copy-to-clipboard inside); RSC if pure render. Default RSC; emit `'use client'` only when copy button needed.

### `index.ts` (barrel)

```ts
export { Button } from './button';
export { Input } from './input';
export { Select } from './select';
export { FormField } from './form-field';
export { Card } from './card';
export { Badge } from './badge';
export { Tabs } from './tabs';
export { Modal } from './modal';
export { Drawer } from './drawer';
export { EmptyState } from './empty-state';
export { LoadingState } from './loading-state';
export { ErrorState } from './error-state';
export { PageHeader } from './page-header';
export { CircularProgress } from './circular-progress';
export { Slider } from './slider';
export { DropZone } from './drop-zone';
export { MarkdownView } from './markdown-view';

// Phase 2+ reserved: Table, Pagination
```

### `README.md` in `src/components/ui/`

```
# Shared UI Module
All visual primitives live here. Feature pages MUST import from this module.

## Phase 1 components
[list above]

## Phase 2+ reserved slots
- Table
- Pagination
```

## Implementation Steps (03a)

1. Create `src/lib/design-tokens.ts` with full token map (mirror DESIGN.md + Stitch HTML config).
2. Update `tailwind.config.ts` to import + spread tokens.
3. Add fonts to `src/app/layout.tsx` (Plus Jakarta Sans + Inter via `next/font/google`) and Material Symbols Outlined via stylesheet link.
4. Build base components in order (03.1): `button`, `input`, `select`, `form-field`, `card`, `badge`, `tabs`, `page-header`.
5. Build states + overlays (03.2): `modal` (radix), `drawer` (radix), `empty-state`, `loading-state`, `error-state`.
6. Build app-specific (03.3): `circular-progress`, `slider`, `drop-zone`, `markdown-view`.
7. Wire `index.ts` barrel.
8. Run Pre-Finalization Scan checklist.

## Todo List

- [ ] `lib/design-tokens.ts` written and exports `tokens` const + `Tokens` type
- [ ] `tailwind.config.ts` extends from tokens — colors, fonts, sizes, radius, spacing, shadow, maxWidth
- [ ] `src/app/layout.tsx` loads Plus Jakarta Sans + Inter via `next/font/google`
- [ ] Material Symbols Outlined font loaded globally
- [ ] `button.tsx` — 4 variants × 3 sizes, loading, icon slots
- [ ] `input.tsx` — text/email/password types, leading/trailing slots, error state
- [ ] `select.tsx` — native select, options array
- [ ] `form-field.tsx` — label + control + error + (optional) helperText
- [ ] `card.tsx` — 3 variants × 3 padding sizes
- [ ] `badge.tsx` — 5 status variants × 2 sizes
- [ ] `tabs.tsx` — underline + pills variants
- [ ] `modal.tsx` — radix-based, 3 sizes
- [ ] `drawer.tsx` — radix-based, right + bottom sides
- [ ] `empty-state.tsx` — icon + title + description + action slot
- [ ] `loading-state.tsx` — spinner + skeleton variants
- [ ] `error-state.tsx` — token-bound error tone, optional retry
- [ ] `page-header.tsx` — title + subtitle + action slot
- [ ] `circular-progress.tsx` — SVG ring, token-bound stroke colors
- [ ] `slider.tsx` — native range input, styled to token
- [ ] `drop-zone.tsx` — drag + click upload, size/ext validation
- [ ] `markdown-view.tsx` — react-markdown + remark-gfm
- [ ] `index.ts` barrel exports all 17 components
- [ ] `README.md` in `components/ui/` documents Phase 2+ reserved slots
- [ ] Each file < 200 LOC verified
- [ ] `pnpm tsc --noEmit` clean
- [ ] `pnpm build` clean

## Success Criteria

- All 17 components render in a `/components-gallery` dev-only route (delete before Phase 1 ship).
- Token edit smoke test: change `tokens.colors.secondary` value → visible color change in `Badge variant="success"`, `CircularProgress`, `LoadingState` spinner.
- No `style={{ ... }}` inline color/spacing/radius/shadow except documented `CircularProgress` SVG dash offset.
- Grep `hex literals` in `components/ui/` returns zero matches outside `circular-progress.tsx` (where SVG stroke uses `currentColor` from Tailwind class — should be zero too).
- All files < 200 LOC.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `react-markdown` adds heavy bundle | Med | Low | Lazy-import `MarkdownView` in feature pages; tree-shake unused remark plugins |
| Radix dialog SSR hydration warning | Med | Low | Mount inside `'use client'` boundary; use Radix's built-in portal |
| Native `<select>` doesn't match Stitch dropdown chrome perfectly | High | Low | Accept slight cosmetic drift Phase 1; Phase 2 swap to headless-ui |
| Slider thumb styling cross-browser | Med | Low | Use `accent-color` (modern browsers) + minor webkit pseudo overrides |
| Font flash (FOUT) before Plus Jakarta Sans loads | Med | Low | Use `next/font/google` `display: 'swap'` + matching fallback |
| DropZone drag events conflict with Next.js dev HMR | Low | Low | Use `e.preventDefault()` in all drag handlers |

## Security Considerations

- `DropZone` validates file size + extension client-side, but server (`/api/parse`) re-validates. Never trust client validation alone.
- `MarkdownView` must render markdown **as text**, not execute embedded HTML. `react-markdown` is XSS-safe by default; do NOT enable `rehype-raw`.
- `Input type="password"` autocomplete attributes: `current-password` for login, `off` for BYOK API key.

## Next Steps

- Sub-phase 03b consumes these components via layouts.
- Sub-phase 03c consumes layouts + these components in feature pages.

## Unresolved Questions

- Should `Select` use native `<select>` (Phase 1 KISS) or headless-ui combobox now? **Proposed: native.** Confirm.
- `Modal` library: Radix vs headless-ui? **Proposed: Radix** (smaller, more focused). Confirm.
- `MarkdownView` table rendering — gfm-style tables OK or restrict? **Proposed: enable gfm**, restrict raw HTML.
