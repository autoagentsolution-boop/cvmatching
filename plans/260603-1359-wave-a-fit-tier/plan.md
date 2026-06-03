---
name: wave-a-fit-tier
title: Wave A + Cover Letter — Fit Tier UX Overhaul
status: completed
created: 2026-06-03
completed: 2026-06-03
ship_by: 2026-06-08
owner: vinh2000ld11@gmail.com
blockedBy: []
blocks: []
related: [260603-1205-ui-polish]
brainstorm: plans/reports/brainstorm-260603-1359-wave-a-fit-tier-features.md
effort: 19-29h (5 days × 6h with ~5h buffer) — actual ~6-8h same-day
---

# Wave A + Cover Letter — Fit Tier UX Overhaul

4 features ship EOW: tier system (E-S badge), red flag UI surface, action column per tier, cover letter endpoint. Wave B (Evidence Map, Interview Points) defer next week.

## Status

✅ **Complete — 2026-06-03.** All 5 phases pulled forward to same day; typecheck + tests + build green. Manual E2E + Lighthouse + cost-guard live inspection pending (need running app + KV); see Phase 5 doc.

## Scope

**In:** F1 Fit Tier, F3 Red Flag UI, F4 Action column wiring, Cover Letter endpoint.
**Out (Wave B):** Evidence Map, Interview Talking Points.

## Stack

Tailwind v4 + Next 16.2.6 App Router + custom atom lib + existing job-fit feature shells.

## Phases

| Day | # | File | Effort | Focus |
|-----|---|------|--------|-------|
| Wed | 1 | [phase-01-fit-tier-foundation.md](./phase-01-fit-tier-foundation.md) ✅ | 3-5h | Tier compute lib + badge atom + normalize + prompt update |
| Thu | 2 | [phase-02-fit-tier-ui-and-red-flags.md](./phase-02-fit-tier-ui-and-red-flags.md) ✅ | 4-6h | Badge wire into job-fit list/detail + red flags both pages |
| Fri | 3 | [phase-03-action-column-wiring.md](./phase-03-action-column-wiring.md) ✅ | 8-12h | 4 action variants navigate via query params, /refined-cv + /career-path pre-fill |
| Sat | 4 | [phase-04-cover-letter-endpoint.md](./phase-04-cover-letter-endpoint.md) ✅ | 4-6h | New endpoint + prompt + cost bucket + UI wire |
| Sun | 5 | [phase-05-polish-smoke-test.md](./phase-05-polish-smoke-test.md) ✅ (partial) | 2-3h | Tests + build + cross-plan + changelog DONE; live E2E + Lighthouse + KV inspection pending |

## Locked decisions (from brainstorm §2)

| Topic | Decision |
|-------|----------|
| Tier format | Hybrid letter (E-S) + semantic tooltip + main reason |
| Tier quota | 1S + 3A + 2B + 2C + 1D + 1E = 10 max |
| Underfill | Honest: show all jobs returned, note "thêm jobs ngày mai" |
| Threshold | LLM scores ALL candidates, no >80 filter |
| Cover quota | 3/day per logged-in user |
| Action S/A | Apply → /refined-cv?mode=apply |
| Action B | Quick Fix → /refined-cv?mode=fill-gaps |
| Action C | Improve → /refined-cv?mode=stretch |
| Action D/E | Roadmap → /career-path?target=&skillGaps= |
| Red Flag UI | Both /analyze section + /refined-cv banner |
| Cost bucket | Add `generate-cover-letter` → 7 buckets total |

## Hard constraints

- `feedback_scoring_ux_model` — sliders semantic preserved, tier is additive
- `feedback_error_surfacing_no_silent_fallback` — cover letter errors visible
- Cost guard pattern from commit `ac27cab` — checkKillSwitch + recordCost gated `!byok`
- Token budget: prompt-job-recommend +25% offset by vertical filter -30% input

## Risks (top 3)

1. **LLM output 10 jobs vượt MAX_TOKENS** → siết per-job to 3 topics × 2 sentences, test với CV/JD lớn
2. **Tier underfill awkward UX** → honest "Chỉ N jobs match" banner, KHÔNG cross-fill
3. **Action button race** → disable per-row + spinner, 1-way navigate

## Success metrics

- Tier distribution ≥60% jobs ≥B (else LLM too strict)
- Action click-through ≥30% recommend pageviews
- Cover letter usage ≥20% of S/A apply
- Recommend p95 ≤ 8s
- Daily shared spend ≤ $5 post-reopen

## Cross-plan coordination

- `260603-1205-ui-polish` will polish atoms in Phase 2 — Wave A creates `<TierBadge>`, `<RedFlagsSection>`, `<RedFlagsBanner>`. UI polish should add tokens for tier-letter colors (S=gold, A=green, B=blue, C=orange, D=gray, E=red) + red-flag color when it executes.
- `career-path-feature` DONE — query param pre-fill is safe to add.

## Next action

Today (Wed): start Phase 1. Activate plan with `/cook` from absolute path of `phase-01-fit-tier-foundation.md`.
