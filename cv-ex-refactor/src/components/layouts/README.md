# Shared Layout Templates

Every feature page composes from one of these templates. No feature page declares
its own grid, sidebar, topnav, or centered-card layout. If a new shape is needed,
add a template here first.

## Phase 1 layouts

| Template | File | Typical use | RSC? |
|---|---|---|---|
| `DashboardLayout` | `dashboard-layout.tsx` | All authed pages — sidebar + topnav shell | No (`'use client'` — mobile drawer state + usePathname) |
| `FormPageLayout` | `form-page-layout.tsx` | Nested inside DashboardLayout; form-shaped pages (Analyze) | Yes |
| `DetailPanelLayout` | `detail-panel-layout.tsx` | Nested inside DashboardLayout; main + right rail (Results, Refined CV) | Yes |
| `AuthLayout` | `auth-layout.tsx` | Login and future auth flows; centered card on patterned bg | Yes |

## Slot reference

### DashboardLayout
| Prop | Type | Required | Notes |
|---|---|---|---|
| `activeNav` | `'analyze' \| 'history' \| 'optimizations' \| 'career-path'` | Yes | Highlights the matching nav item |
| `topnavTitle` | `string` | No | Page title shown in topnav bar |
| `topnavActions` | `ReactNode` | No | Right-side topnav content (bell, avatar, quota badge) |
| `proCtaSlot` | `ReactNode` | No | Phase 1: leave undefined. Phase 2: inject Pro upgrade card |
| `children` | `ReactNode` | Yes | Main content area |

Responsive: lg+ sidebar fixed 256px; below lg sidebar hidden, hamburger opens right Drawer.
Mobile bottom nav deferred to Phase 2.

### FormPageLayout
| Prop | Type | Required | Notes |
|---|---|---|---|
| `header` | `ReactNode` | No | Typically `<PageHeader />` |
| `children` | `ReactNode` | Yes | Form sections stacked with `space-y-6` |
| `actionsSlot` | `ReactNode` | No | Sticky bottom bar on mobile; inline on desktop |
| `meta` | `ReactNode` | No | Small note below actions (e.g., "Est. 4–6 seconds") |

Max width: 920px. Mobile adds `pb-24` to prevent content hiding behind sticky bar.

### DetailPanelLayout
| Prop | Type | Required | Notes |
|---|---|---|---|
| `header` | `ReactNode` | No | Typically `<PageHeader />` |
| `children` | `ReactNode` | Yes | Primary content (left / full column) |
| `asideSlot` | `ReactNode` | Yes | Right rail (score block, enhancements, etc.) |
| `asideWidth` | `'sm' \| 'md' \| 'lg'` | No | 280 / 320 / 360px. Default `md` |
| `asideSide` | `'right'` | No | Future-proof; Phase 1 right only |

Responsive: xl+ flex row with sticky aside; below xl aside stacks below main.

### AuthLayout
| Prop | Type | Required | Notes |
|---|---|---|---|
| `children` | `ReactNode` | Yes | Auth card content |
| `footerSlot` | `ReactNode` | No | Terms / Privacy links |
| `badgeSlot` | `ReactNode` | No | Fixed bottom-left badge (social proof); hidden below lg |

## Approved extensions

**AuthLayout** is not in the 5 originally mandated layout names
(`AdminPageLayout`, `ListPageLayout`, `FormPageLayout`, `DetailPanelLayout`, `DashboardLayout`)
but auth pages require a fundamentally different shell — no sidebar, no topnav,
centered card on patterned background. Force-fitting `DashboardLayout` with all
slots disabled is an anti-pattern. Extension approved and documented here.

## Phase 2+ reserved

- `AdminPageLayout` — admin surfaces
- `ListPageLayout` — paginated list pages

## Composition rule

Route-level `layout.tsx` files in `src/app/` are thin wrappers only.
They call these templates — they do not redefine layout structure.

```tsx
// src/app/(app)/layout.tsx — thin wrapper pattern
import { DashboardLayout } from '@/components/layouts';
export default function AppLayout({ children, params }) {
  return (
    <DashboardLayout activeNav={deriveNav(params)}>
      {children}
    </DashboardLayout>
  );
}
```

## Breakpoint reference

| Token | Value | Used by |
|---|---|---|
| `md` | 768px | Topnav padding switch |
| `lg` | 1024px | Sidebar visible / hidden |
| `xl` | 1280px | DetailPanelLayout column split |
