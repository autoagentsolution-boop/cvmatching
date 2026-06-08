# Phase 1 — Dual-Lens Schema + Anti-Hedging

**Priority:** P0 — validates the core hypothesis
**Status:** Not started (deferred behind UI/UX IA refactor)
**Estimated effort:** 1 day

## Context

- Audit: `plans/reports/researcher-260608-1235-llm-prompts-audit.md`
- All 4 surfaces today write single-voice output ("You are an expert recruiter")
- User explicitly requested: factors visible from **both recruiter perspective AND self perspective** so user sees their own strengths/weaknesses

## Insight

The single biggest perceived-value lever is **structural**, not lexical: surface `recruiterView` + `selfView` as separate fields per finding, instead of mashing them into one paragraph that politely hedges.

## Requirements

Functional:
- Each finding (metric, gap, recommendation, job match) carries TWO short strings: what a hiring recruiter sees vs what the candidate should know about their own evidence
- Anti-hedging language enforced via prompt instruction (no "consider", "might want to", "could strengthen" → use "this fails because" / "this works because")
- All schema changes backwards-compatible: add new optional fields; UI falls back to old single-voice rendering when absent
- LLM temperature stays at 0.3 (variance is not the problem; phrasing pattern is)

Non-functional:
- No new infra (no shared candidate-profile cache yet — that's a possible Phase 4)
- Token cost increase per workflow: +~3K output tokens (~+20%)
- Latency: +2-3s per surface (acceptable)

## Architecture

Per-surface schema additions (all optional for backwards compat):

```ts
// Scoring v3 (prompt-analyze-v3.ts) — add to top-level result
detectedRolePersona?: {
  title: string;
  recruiterScanTime: string;          // "6-8s"
  top3RecruiterChecks: string[];      // generic for now; Phase 2 grounds from pool
  yourCvIn6Seconds: string;           // brutal first-impression snapshot
};
// + per metric:
metrics[i].recruiterLens?: string;    // "HR sees X in this dim"
metrics[i].selfLens?: string;         // "what you should know about your evidence"

// Job Fit (prompt-job-recommend.ts) — per job
jobs[i].recruiterView?: string;       // 1-2 sentences what THIS company's HR sees
jobs[i].selfView?: string;            // 1-2 sentences candidate-eye honest read
jobs[i].applyOrSkip?: boolean;        // forced binary verdict
jobs[i].applyReasoning?: string;      // 1 sentence why apply / why skip

// Career Roadmap (prompt-career-path.ts) — per milestone
milestones[i].recruiterSignal?: string;  // "after this, recruiter scanning LinkedIn sees X"

// Refined CV (prompt-generate-cv.ts) — Block 2 RefineNotes restructured
// (handled in Phase 3 — keep Phase 1 scope to JSON-only surfaces)
```

## Related code files

To modify (no new files unless noted):
- `src/lib/llm/prompt-analyze-v3.ts` — append schema fields, add dual-lens + anti-hedging instructions to user prompt
- `src/lib/llm/prompt-career-path.ts` — same pattern for milestones
- `src/lib/llm/prompt-job-recommend.ts` — same for per-job blocks
- `src/lib/llm/normalize-analyze-v3.ts` (or equivalent) — Zod schema add optional fields
- `src/lib/llm/normalize-job-recommend.ts` — Zod schema add optional fields
- `src/lib/llm/normalize-career-path.ts` — Zod schema add optional fields
- UI components rendering scoring/jobfit/roadmap cards — conditionally render new fields when present (specific files depend on UI/UX refactor output)

## Implementation steps

1. Edit `prompt-analyze-v3.ts`:
   - Add `detectedRolePersona` block to schema string
   - Add `recruiterLens` + `selfLens` to per-metric schema
   - Append to user prompt: anti-hedging rule + dual-lens contract
2. Mirror for `prompt-career-path.ts` (milestone.recruiterSignal)
3. Mirror for `prompt-job-recommend.ts` (per-job recruiterView/selfView + applyOrSkip)
4. Update each `normalize-*.ts` Zod schema with `.optional()` new fields
5. Add type exports for downstream UI consumption
6. Run vitest — existing tests should still pass (backwards-compat)
7. Manual smoke: hit each endpoint with sample CV, verify new fields populated, check anti-hedging actually drops "consider"/"might" frequency by ≥80% in output sample
8. UI render — defer to UI/UX refactor or stub minimal rendering for testing

## Todo

- [ ] Edit `prompt-analyze-v3.ts` schema + prompt
- [ ] Edit `prompt-career-path.ts` schema + prompt
- [ ] Edit `prompt-job-recommend.ts` schema + prompt
- [ ] Update Zod normalizers (all 3)
- [ ] Run `pnpm test` (existing tests pass)
- [ ] Manual smoke each endpoint with real CV
- [ ] Word-frequency check: "consider|might|could" dropped ≥80% vs baseline sample
- [ ] Coordinate with UI/UX refactor for render components

## Success criteria

- All 3 endpoints return new optional fields when LLM populates them
- Backwards compat: old UI keeps working with old payloads
- Anti-hedging: sample outputs show direct verdict language, no "consider improving..."
- Token cost increase ≤25% per call

## Risks

- **LLM ignores new schema fields** — Gemini sometimes drops fields not in middle of schema. Mitigation: put new fields BEFORE existing ones in schema string, add explicit rule "Every metric MUST include recruiterLens and selfLens".
- **`applyOrSkip` collapses to all-true or all-false** — flatness defeats purpose. Mitigation: prompt rule "At least 1 of 6 jobs must be applyOrSkip=false unless pool is exceptionally strong".
- **Output too long → token cap hit** — current 16K cap. Mitigation: tighten existing verbose fields (matchReasons 3-5 → 2-3), monitor for truncation, bump cap if needed.

## Security

- No new attack surface — prompts and schemas only, no new user input paths
- Anti-fabrication rule stays in system prompt ("Never invent candidate experience")

## Next steps

→ Phase 2: pool-ground Job Fit + Roadmap with real PG JD must-haves
→ Phase 3: Refined CV ATS keyword inject + voice preservation + interview prep
