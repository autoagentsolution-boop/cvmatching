# Phase 1 — Token + Shell Foundation

**Effort:** 2-3h | **Priority:** High | **Status:** Pending
**Brainstorm ref:** §5 Phase 1

## Goal

Refresh Tailwind v4 design tokens (color, space, radius, shadow, motion) trong `globals.css` + polish app shell (sidebar, topbar). Existing atoms tự inherit token mới.

## Key insights

- Tailwind v4 = CSS-vars-native qua `@theme` directive. KHÔNG cần `tailwind.config.js`.
- Mọi atom hiện đang dùng `var(--*)` hoặc Tailwind utility class → token refresh propagates automatically.
- Sidebar đã có structure (Upgrade-Pro card). Chỉ visual polish.

## Files

**Modify:**
- `cv-ex-refactor/src/app/globals.css` — refresh `@theme` block
- `cv-ex-refactor/src/components/layout/sidebar.tsx` (or `src/components/sidebar.tsx` — verify path) — active/hover state, Upgrade-Pro card styling
- `cv-ex-refactor/src/components/layout/topbar.tsx` (verify path) — logo + sign-in button styling
- `cv-ex-refactor/src/app/(app)/layout.tsx` — shell composition nếu cần

**Audit (read-only):**
- `cv-ex-refactor/src/components/ui/*.tsx` — list những file consume token nào (grep `var(--` + tailwind class)

## Token scope

```css
@theme {
  /* Color — brand */
  --color-brand-50: ...;
  --color-brand-500: ...;  /* primary actions */
  --color-brand-600: ...;  /* hover */

  /* Color — semantic */
  --color-success-500: ...;  /* green check chips */
  --color-error-500: ...;
  --color-muted-50/100/200: ...;
  --color-neutral-{50..900}: ...;

  /* Space */
  --space-tight-{1,2,3}: 4px / 8px / 12px;
  --space-regular-{1,2,3}: 16px / 24px / 32px;
  --space-large-{1,2}: 48px / 64px;

  /* Radius */
  --radius-chip: 6px;
  --radius-card: 12px;
  --radius-cta: 16px;

  /* Shadow */
  --shadow-card-rest: ...;
  --shadow-card-hover: ...;
  --shadow-sticky-footer: ...;

  /* Motion */
  --ease-out-fast: cubic-bezier(...) 150ms;
  --ease-in-out-page: ... 250ms;
}
```

Exact values: pick từ mockup eyedropper. Default to Tailwind v4 ramps nếu approximate.

## Implementation steps

1. **Grep audit** — list tokens nào atom đang dùng:
   ```
   grep -r "var(--" cv-ex-refactor/src/components/ui/
   grep -rE "bg-|text-|border-" cv-ex-refactor/src/components/ui/ | wc -l
   ```
2. **Backup current `globals.css`** dạng comment block (rollback fallback).
3. **Write new `@theme` block** với token scope ở trên.
4. **`npm run typecheck`** — đảm bảo không break TS.
5. **`npm run build`** — đảm bảo Tailwind v4 không complain unknown utility.
6. **Visual smoke** — `npm run dev`, mở `/analyze`, scroll xem có atom nào vỡ.
7. **Polish sidebar:**
   - Active item: background + left-border accent
   - Hover state: subtle bg shift
   - Upgrade-Pro card: card style từ token mới, NO copy change
8. **Polish topbar:**
   - Logo position + spacing
   - Sign-in button: outline variant với new tokens
9. **Commit** `feat(ui): refresh design tokens + shell polish`.

## Acceptance

- `npm run build` xanh
- `npm run typecheck` xanh
- Visual smoke `/analyze` shell match mockup (sidebar + topbar)
- Existing atom consumers (button, card, badge, etc.) render correctly với new tokens
- Screenshot `passE-phase1-shell.png` saved to `plans/reports/`

## Risks

- **Unknown utility in Tailwind v4:** Specific v3 classes deprecated. Mitigation: build-first verify.
- **Atom breakage:** atom đang hardcode hex → token change không apply. Mitigation: grep audit Step 1.
- **Token name collision:** existing CSS vars override. Mitigation: namespace `--brand-*` / `--color-*` rõ ràng.

## Next

Phase 2 — atoms.
