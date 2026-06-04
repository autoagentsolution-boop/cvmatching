# Phase 1 — Scoring Prompt Rewrite (CV-Solo 9-Dim Rubric)

**Effort:** 2-3h
**Owner:** lead
**Status:** pending
**Blocks:** phases 2, 3, 4, 5, 6, 7

## Goal

Rewrite `prompt-analyze.ts` from CV-vs-JD matching to CV-intrinsic per-dim quality for a user-claimed role. Output schema stays compatible with the 9-dim slider UX; semantics of each dim's score change. Ship A/B fixture suite to verify v3 output quality matches or exceeds v2 on the same CV sample.

## Files to Create

- `src/lib/llm/prompt-analyze-v3.ts` — new prompt module (≤ 200 lines), exports `buildAnalyzeV3Prompt(cv, role): { system, user, schema }`
- `src/lib/llm/normalize-analyze-v3.ts` — output shape + validation (≤ 120 lines), accommodates `inferredRole` + per-dim CV-solo semantics
- `tests/prompt-analyze-v3.test.ts` — fixture suite with 10 sample CVs (mix VN + EN, mix seniorities, mix verticals); snapshot expected scoring shape

## Files to Modify

- `src/lib/llm/prompt-analyze.ts` — leave intact for now (v2 path); deprecate via comment, full removal in Phase 7
- `src/lib/llm/normalize-analyze.ts` — leave intact; v3 has its own normalizer

## Output Schema (Zod)

```ts
export const AnalyzeV3Schema = z.object({
  schemaVersion: z.literal('v3'),
  inferredRole: z.object({
    canonical: z.string(),                  // e.g. "Senior Backend Engineer"
    confidence: z.number().min(0).max(1),
    alternates: z.array(z.string()).max(3), // top-3 candidates for confirm UI
  }),
  overallScore: z.number().min(0).max(100),
  metrics: z.array(z.object({
    dim: z.enum(['skills','experience','seniority','tools','domain','industry','education','location','soft']),
    score: z.number().min(0).max(100),
    rationale: z.string().max(200),          // 1-line why
  })).length(9),
  strengths: z.array(z.string()).max(5),
  weaknesses: z.array(z.string()).max(5),
  presentationIssues: z.array(z.string()).max(5),  // NEW — was JD-coverage gaps
  experienceGaps: z.array(z.string()).max(5),       // NEW — was JD-must-have gaps
  recommendations: z.array(z.string()).max(5),
  keywordCoverage: z.array(z.object({
    keyword: z.string(),
    presence: z.enum(['strong','weak','missing']),
  })).max(20),
  suggestedSummaryLine: z.string().max(160),
  redFlags: z.array(z.string()).max(5),
});
```

## Prompt Template (sketch)

```ts
export function buildAnalyzeV3Prompt(cv: string, role: string): { system: string; user: string } {
  return {
    system: `Bạn là chuyên gia HR + headhunter. Đánh giá CV theo claimed role bằng thang 0-100 trên 9 chiều. KHÔNG dùng JD — chỉ CV + role. Mỗi điểm phải có rationale ngắn.

Rubric:
- skills (0-100): độ sâu/rộng/hiện đại của technical stack so với role
- experience (0-100): chất lượng narrative — impact, scope, progression, quantified results
- education (0-100): signaling quality + role fit
- seniority (0-100): CV có demonstrate đúng level claimed?
- tools (0-100): tool stack depth cho role
- domain (0-100): domain depth presentation
- industry (0-100): industry presentation strength
- location (0-100): clarity + presentation (visa/remote-ready signals)
- soft (0-100): soft skills evidenced rõ ràng

Phân loại điểm:
- 80-100 = strong, role-ready signal
- 60-79  = competent, refinable
- 40-59  = present but weak
- 0-39   = missing/regressed

Output strict JSON theo schema. KHÔNG narrative ngoài JSON.`,

    user: `Role claimed: ${role}

CV:
${cv}

Trả JSON theo schema.`,
  };
}
```

## Implementation Steps

1. Define `AnalyzeV3Schema` in `normalize-analyze-v3.ts` with Zod. Cover all v2 fields users see + new fields (`inferredRole`, `presentationIssues`, `experienceGaps`).
2. Implement `buildAnalyzeV3Prompt` per sketch above. Iterate VN/EN phrasing for clarity — VN primary since users primarily VN, but role inference should work on EN CVs too.
3. Implement `parseAnalyzeV3Response(raw): Result<AnalyzeV3>` — wraps Zod validation + LLM retry on parse failure (1 retry, per [[feedback_prompt_engineering_discipline]]).
4. Write `tests/prompt-analyze-v3.test.ts`:
   - 10 sample CVs in `tests/fixtures/cvs/` covering tech junior + tech senior + marketing mid + finance senior + ops mid + ambiguous role + minimal CV + diacritic-heavy VN CV + bilingual + headhunter-style
   - For each fixture: run via mocked Gemini OR golden-output approach (commit expected JSON in `tests/fixtures/analyze-v3-expected/`)
   - Assert: schema validates, score range 0-100, 9 dims present, rationales non-empty, inferredRole non-empty
5. **A/B quality review**: pick 3 fixtures; manually run both v2 prompt and v3 prompt against actual Gemini; compare strengths/weaknesses/recommendations. Capture findings in `phase-01-quality-review.md` doc. Ship if v3 ≥ v2 on subjective quality; iterate prompt if regression.
6. `pnpm tsc --noEmit` + `pnpm vitest run prompt-analyze-v3` until green.

## Acceptance Criteria

- [ ] `AnalyzeV3Schema` defined + exported; covers role inference + 9-dim + frozen artifacts
- [ ] `buildAnalyzeV3Prompt` returns system + user strings; passes lint + tsc
- [ ] 10 fixture tests pass (schema validation + range checks)
- [ ] A/B quality review committed; v3 not regressed vs v2 on 3 sampled CVs
- [ ] Tests 56+10 = 66/66 pass (existing taxonomy + new analyze v3)
- [ ] tsc clean

## Risks

- **Prompt regression**: v3 output may underperform v2 on certain CV types. Mitigation: A/B review before locking; iterate prompt; keep v2 callable via feature flag during transition.
- **Schema breaking change**: removing `must-haves` field from response. Mitigation: v3 normalizer is separate file; v2 normalizer untouched; UI Phase 3 reads only v3 normalizer.
- **Token budget**: longer prompt + 2 LLM calls (infer + score) may exceed current budgets. Mitigation: role-infer is cheap (~$0.001); scoring is similar cost to v2. Measure and document in Phase 2.

## Security

- No PII leakage: prompt instructs to redact names + emails from rationales (defense in depth — UI filters too)
- Output sanitization preserved: all rendered fields pass through existing HTML escape in UI

## Next Phase

→ phase-02-api-analyze-refactor.md
