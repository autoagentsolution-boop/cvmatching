# LLM Prompts — Dual-Lens Redesign

**Created:** 2026-06-08
**Status:** DEFERRED behind UI/UX IA refactor (see memory `plan_ui_ux_ia_refactor`)
**Owner:** Vincere
**Estimated effort:** 2.5 days total (across 3 phases)

## Why

4 user-facing LLM surfaces (Scoring, Roadmap, Job Fit, Refined CV) all suffer the same root issue: **single-voice output that hedges**, no dual perspective (recruiter vs self), no grounding in the 332-job PG pool, no anti-padding guardrails. User test verdict: "1 chút vấn đề cần brainstorm lại để mang lại giá trị hơn".

Audit confirmed (see `plans/reports/researcher-260608-1235-llm-prompts-audit.md`):
- No shared upstream candidate-analysis layer — 4 independent LLM calls re-infer role 4× → inconsistent + wasteful
- Pool-grounding gap: Job Fit prompt already has anti-bunching rules ("KHÔNG dồn cụm 80-85"), but Roadmap/Refine ignore the 332 real JDs
- Refined CV has v0.4 `mustHaves[]` field but does NOT inject it as required ATS keywords
- All surfaces use single-voice "expert recruiter" prompt — no `selfView` per finding

## Success criteria

After 3 phases ship, one full user session (Analyze → Roadmap → JobFit → Refine) should leave the user with:
1. Clear "recruiter sees X in 6 seconds" snapshot per CV dimension
2. Honest "your weak spot is Y, don't apply to Z" verdict per job
3. 5 concrete actions for next 7 days (not 30/60/90 — too far for habit)
4. Refined CV with real JD keywords + 3 interview questions they WILL be asked

## Phases

| # | File | Effort | Risk | Value |
|---|------|--------|------|-------|
| 1 | [phase-01-dual-lens-schema.md](./phase-01-dual-lens-schema.md) | 1 day | Low (backwards-compat schema add) | High — validates dual-lens hypothesis |
| 2 | [phase-02-pool-grounded-jobfit-roadmap.md](./phase-02-pool-grounded-jobfit-roadmap.md) | 1 day | Medium (PG query + prompt context) | High — kills generic advice |
| 3 | [phase-03-refined-cv-ats-voice-interview.md](./phase-03-refined-cv-ats-voice-interview.md) | 0.5 day | Low | Medium-High — interview prep is new feature |

**Ship Phase 1 first, validate, then continue.** If dual-lens "click" doesn't land, stop and re-brainstorm.

## Dependencies

- **BLOCKED by:** UI/UX IA refactor (Stitch-driven, see memory `plan_ui_ux_ia_refactor`) — schema changes here need new card components to render dual-lens fields without bloating layout
- **Requires:** Postgres pool ≥500 jobs per role for Phase 2 grounding to be useful. Current: tech=90, senior=22, tech.data≈0. Phase 9 of `plans/260606-1231-jobfit-db-pool-monetize` (listing pre-filter + jitter + VNW re-probe) needs to ship first
- **Touches:** `src/lib/llm/prompt-{analyze-v3,career-path,job-recommend,generate-cv}.ts`, normalize-* counterparts, related route handlers, downstream UI components

## Open decisions — ALL LOCKED 2026-06-08

1. **Pool-grounding scope for Job Fit:** **Top-5 must-haves of jobs being scored** (per-job grounding, not role-level). Each job in LLM context carries its own `mustHaves[]`; prompt rule: `recruiterView MUST cite ≥1 mustHave from THIS job verbatim`.
2. **Interview prep angle (Refined CV Phase 3):** **Gap-attack**. 3 questions target the weakest evidence dimension of the CV. Prompt rule: `questions must target the candidate's weakest CV evidence — not "tell me about yourself"`.
3. **Brutal tier:** **Global drop hedging** — no toggle. All 4 surface prompts append: `no "consider"/"might want to"/"could strengthen" — use "this fails because"/"this works because"`. App-wide tone, no opt-in needed.

## Cost/token impact

Per full workflow (Analyze + Roadmap + JobFit + Refine):
- Today: ~$0.005 (≈15K out tokens × $2.5/1M)
- After all 3 phases: ~$0.010 (2× cost, 3-5× perceived value if dual-lens lands)
- Latency: +4-5s total across surfaces — acceptable

## Cross-references

- Audit report: `plans/reports/researcher-260608-1235-llm-prompts-audit.md`
- Active plan blocking pool growth: `plans/260606-1231-jobfit-db-pool-monetize/`
- UI/UX IA refactor: see memory `plan_ui_ux_ia_refactor`
- Scoring UX contract (sliders): see memory `feedback_scoring_ux_model`
