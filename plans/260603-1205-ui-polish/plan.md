---
name: ui-polish
title: UI Polish — /analyze + App Shell
status: pending
created: 2026-06-03
owner: vinh2000ld11@gmail.com
blockedBy: [260602-1739-hybrid-refresh-topup]
blocks: []
absorbs: [260527-1117-phase-1-1-polish-queue#B, 260527-1117-phase-1-1-polish-queue#C]
related: [260603-1359-wave-a-fit-tier]
brainstorm: plans/reports/brainstorm-260603-1205-ui-polish.md
mockup: UIEnhance/UIUXSpace.png, UIEnhance/2026-05-27_14-02.png, UIEnhance/RequirementLoad.png
baseline: plans/reports/passD-analyze-with-jd.png
effort: 8-12h
prs: 2 (foundation / page)
---

# UI Polish — /analyze + App Shell

Visual + UX polish pass đưa `/analyze` page và app shell từ "functional" lên "production-grade" theo mockup `UIEnhance/`. Full design + resolved decisions trong brainstorm report.

## Status

📋 **Pending — execution deferred.** Queue order:
1. WIP vertical-aware rec (current session)
2. Pilot re-enable runbook (this week)
3. **`260602-1739-hybrid-refresh-topup`** (R1–R7)
4. **này** ← unblock khi #3 completes

## Scope

**In:** `/analyze` page, sidebar, topbar, auth shell, design tokens, atom library refinements.
**Out:** History, Optimizations, Career Path, Pricing, Settings, /sign-in (separate polish later); BE work (must-haves endpoint đã có).

## Stack

- Tailwind v4 (`@theme` CSS vars)
- Next 16.2.6 App Router
- `clsx` + `tailwind-merge` → `cn()`
- Custom atom lib `src/components/ui/` (NO shadcn/Radix)

## Phases

| # | File | Effort | Focus |
|---|------|--------|-------|
| 1 | [phase-01-token-shell-foundation.md](./phase-01-token-shell-foundation.md) | 2-3h | Tailwind v4 tokens + sidebar/topbar polish |
| 2 | [phase-02-atoms.md](./phase-02-atoms.md) | 2-3h | 3 new atoms + 5 refined atoms |
| 3 | [phase-03-wire-analyze-page.md](./phase-03-wire-analyze-page.md) | 3-4h | Replace inline styles trong /analyze sections |
| 4 | [phase-04-snapshot-diff.md](./phase-04-snapshot-diff.md) | 1-2h | Screenshot vs mockup, tweak, ship-ready |

**PR split:** P1+P2 = "foundation" PR. P3+P4 = "page" PR.

## Hard constraints (from memory)

- `feedback_ui_ux_design_system` → tokens-first contract, shared components, no leaked prompt text
- `feedback_scoring_ux_model` → sliders polish PRESERVE semantic (LLM scores, client-side override → overall recompute). Preset KHÔNG động sliders.
- `feedback_error_surfacing_no_silent_fallback` → must-haves loading state có error state đối xứng (4xx/5xx visible).

## Resolved decisions (brainstorm §9)

| Topic | Decision |
|-------|----------|
| Sidebar Upgrade-Pro copy | Final — visual polish only |
| CTA disable rule | `disabled = !hasResume \|\| !hasJD \|\| mustHavesStatus === 'error'` — `'extracting'` không block |
| Preset side-effect | Apply 4 selector + toggles, KHÔNG touch sliders |
| Tailwind v4 + Next 16.2.6 | Verified runtime; re-check nếu P1 build fails |

## Wave A handoff (2026-06-03 EOD)

Wave A (`260603-1359-wave-a-fit-tier`) shipped 4 new atoms / components that this polish pass should fold into the token system when it executes:

| Atom | Where | What to token-ify |
|------|-------|-------------------|
| `<TierBadge>` (`src/components/ui/tier-badge.tsx`) | Job-fit list + detail | Tier color map currently `bg-amber-100`/`bg-emerald-100`/etc. — add semantic tokens `--color-tier-s`, `--color-tier-a`, … `--color-tier-e` + `-on-` pair |
| `<RedFlagsSection>` (`src/features/analyze/red-flags-section.tsx`) | /analyze results | Amber left-border (`border-l-amber-500`) → `--color-warning-strong` |
| `<RedFlagsBanner>` (`src/features/refined-cv/red-flags-banner.tsx`) | /refined-cv top | Amber surface (`bg-amber-50 text-amber-950`) → `--color-warning-container` + `-on-` pair |
| Mode banner (`src/features/refined-cv/refined-cv-mode-banner.tsx`) | /refined-cv top | Primary left-border + label — uses existing tokens, just review spacing |

All four currently use raw Tailwind palette utilities — intentional one-shot in Wave A so we ship; tokenization owned by this plan.

## Deltas D1-D8

Đầy đủ trong brainstorm report §3. Tóm tắt:
- D1 chip pills must-haves, D2 must-haves loading, D3 JD empty-hint, D4 PrimaryCTA+ETA, D5 polished sliders, D6 upload empty-states, D7 industry preset, D8 spacing/elevation đồng đều.

## Success metrics

- Pixel-similarity ≥85% với mockup (snapshot diff)
- 0 console warnings, Lighthouse a11y ≥95, CLS <0.1
- Typecheck + lint clean
- Manual regression: idle → paste JD → extract must-haves → upload CV → submit → results unchanged

## Risk top-3

1. Token refresh phá vỡ existing atoms → Phase 1 grep all imports + typecheck trước commit
2. Slider polish phá scoring semantic → e2e test override flow
3. CLS khi PrimaryCTAWithETA enable/disable → fixed height container, opacity swap

## Next action khi unblock

`/cook` từ phase-01-token-shell-foundation.md theo absolute path.
