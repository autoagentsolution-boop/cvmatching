# Shared UI Module

All visual primitives live here. Feature pages MUST import from `@/components/ui` — no inline visual primitives.

All token values originate in `src/app/globals.css` (`@theme` block). The TypeScript mirror is `src/lib/design-tokens.ts` (for runtime TS code only, e.g. SVG stroke colors).

## Phase 1 components (16)

### Base
- `Button` — 4 variants × 3 sizes, loading spinner, icon slots, `asChild` support
- `Input` — text/email/password/number, leading/trailing slots, error state
- `Select` — native select, options array, error state
- `FormField` — label + control + error + optional helper text wrapper
- `Card` — 3 variants (default/interactive/inverse) × 3 padding sizes
- `Badge` — 7 variants × 2 sizes, pill shape
- `Tabs` — underline + pills variants via Radix Tabs primitive
- `PageHeader` — title + subtitle + action slot + breadcrumb slot

### Overlay + State
- `Modal` — Radix Dialog, 3 sizes, backdrop blur, ESC + focus trap
- `Drawer` — Radix Dialog side variant, right + bottom sides
- `EmptyState` — icon + title + description + action slot
- `LoadingState` — spinner + skeleton variants, 3 sizes
- `ErrorState` — error-tone card, optional retry callback

### App-specific
- `CircularProgress` — SVG ring with animated stroke-dashoffset, token-bound colors
- `Slider` — Radix Slider, gradient track, accessible thumb
- `DropZone` — drag-and-drop + click upload, client-side size/ext validation
- `MarkdownView` — react-markdown + remark-gfm, manually token-bound styles (no @tailwindcss/typography)

## Phase 2+ reserved slots
- `Table` — sortable data table with pagination support
- `Pagination` — page controls for list views

## Usage rules
- Import only from `@/components/ui` — never from individual files in feature code
- No business logic in this module — API calls, stores, and validation belong in `src/features/`
- To add a new shared component: create the file here, export from `index.ts`, document above
