# Phase 02 — LLM Prompts (Gen + Grade) + Zod Schemas

## Context Links
- Memory: `feedback_prompt_engineering_discipline` — diagnose before rewriting; verbose prompts often degrade output. Keep these prompts tight.
- Memory: `project_cvmatching_2026_06_10_state` — `gemini-flash-latest` is default; fallback chain wired into recommend+analyze. Extend pattern.
- Memory: `feedback_error_surfacing_no_silent_fallback` — schema-validation failure must surface; do not silently retry forever.
- Related files: `cv-ex-refactor/src/lib/llm/call-llm.ts`, `cv-ex-refactor/src/lib/llm/call-llm-with-fallback.ts`, existing `cv-ex-refactor/src/lib/llm/prompt-analyze-*.ts` for prompt patterns

## Overview
- **Priority:** P1 (blocks Phase 03)
- **Status:** pending
- **Description:** Author two provider-agnostic prompts (`interview-gen`, `interview-grade`) and Zod schemas for their JSON output. Outputs feed `interview_sessions.dual_lens` + `.questions` JSONB columns. No call sites yet — those land in Phase 03.

## Key Insights
- One prompt produces BOTH Dual Lens (4 quadrants) AND 10 Q with rubric in a single call. Combined call is cheaper + keeps tone consistent across both artifacts.
- Question distribution is locked: 4 behavioral, 4 technical, 2 scenario. Encode in the prompt + validate in Zod (count + type distribution).
- Grade prompt receives all 10 Q + rubric + answers in one batched call; output array of 10 grades. Cheaper than 10 calls + consistent calibration.
- Rubric `score` is 0..3 (0 fail / 1 weak / 2 solid / 3 excellent). Overall = avg × 10/3 → 0..10 float, round to 1 decimal.
- LLM output JSON. Use `response_mime_type: 'application/json'` (Gemini) or `response_format: json_object` (OpenAI) when provider supports.

## Requirements
**Functional:**
- `buildInterviewGenPrompt(input)` returns `{ system, user }` strings.
- `buildInterviewGradePrompt(input)` returns `{ system, user }` strings.
- `interviewGenOutputSchema` (Zod) validates Dual Lens + 10 questions (exact count + type distribution).
- `interviewGradeOutputSchema` (Zod) validates array of 10 grades with score 0..3.

**Non-functional:**
- Each prompt file < 200 lines.
- Output language matches user's i18n locale (VI/EN) — pass `locale` into prompt.
- Token budget: gen ≈ 2.5k in / 2.5k out; grade ≈ 5k in / 3k out. Document at top of file.

## Architecture
```
buildInterviewGenPrompt({
  mode, roleTitle, jobDescription?, anchorRole, locale
})  → { system, user }

callLLM(provider, { system, user, json: true })
  → raw string
  → JSON.parse → interviewGenOutputSchema.parse
  → { dualLens, questions }
```
Same shape for grade.

## Related Code Files
**Create:**
- `cv-ex-refactor/src/lib/llm/prompt-interview-gen.ts` — builder + token-budget comment + JSON output contract example
- `cv-ex-refactor/src/lib/llm/prompt-interview-grade.ts` — builder + token-budget comment + JSON output contract example
- `cv-ex-refactor/src/lib/llm/schemas-interview.ts` — `interviewGenOutputSchema`, `interviewGradeOutputSchema`, exported TS types

**Modify:** none in this phase
**Delete:** none

## Implementation Steps
1. Read 1-2 existing prompt builders (e.g. `prompt-analyze-*.ts`) to mirror style + system/user split + locale handling.
2. Create `schemas-interview.ts`:
   - `dualLensSchema` — 4 quadrants each `{ reasons|opportunities|risks: string[], signals|gaps|growth|mismatches: string[] }`.
   - `interviewQuestionSchema` — `{ id, type, question, rubric: { criteria, excellent_signals, fail_signals } }`. Add `.refine` to validate `id` format `q1..q10`.
   - `interviewGenOutputSchema` — `{ dualLens, questions: array.length(10).refine(typeDist) }` where typeDist checks 4/4/2.
   - `interviewGradeOutputSchema` — `array.length(10)` of `{ id, score: 0|1|2|3, feedback, improvements: string[] }`.
   - Export TS types via `z.infer`.
3. Create `prompt-interview-gen.ts`:
   - Top-of-file comment: token budget (in ≈ 2.5k, out ≈ 2.5k), purpose, output shape link to schema.
   - `system`: terse — role of LLM (senior interviewer + recruiter), output contract is strict JSON matching schema, locale instruction.
   - `user`: inputs (target role + JD optional + anchor CV role) → ask for Dual Lens (4 quadrants from BOTH perspectives) + 10 questions (4 behavioral, 4 technical, 2 scenario, medium-hard, anchored to the candidate's actual experience).
   - Provide a 1-shot example fragment for the JSON output (compact, not full 10 Q).
4. Create `prompt-interview-grade.ts`:
   - `system`: senior interviewer grading by rubric, strict 0..3 score, concise feedback + 2-3 specific improvements per Q.
   - `user`: serialized Q + rubric + candidate answer for all 10. Request batched grades.
5. Run `pnpm tsc --noEmit` to verify Zod schemas type-export cleanly.
6. Manual smoke: write a one-off scratch script (NOT committed) that calls Gemini with a fake input → confirms output passes schema. Discard after.

## Todo List
- [ ] Author dualLensSchema + interviewQuestionSchema in schemas-interview.ts
- [ ] Author interviewGenOutputSchema + interviewGradeOutputSchema with refines
- [ ] Author prompt-interview-gen.ts (system+user builder)
- [ ] Author prompt-interview-grade.ts (system+user builder)
- [ ] Token budget comments at top of each prompt file
- [ ] Locale handling (VI/EN) plumbed into both prompts
- [ ] tsc green
- [ ] Manual smoke against Gemini once

## Success Criteria
- Schemas compile and `z.infer` types match the JSONB shape locked in plan overview.
- One scratch invocation against Gemini returns output that passes both schemas.
- Both prompt files < 200 lines.
- Locale parameter affects output language (VI test produces VI output).

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM emits invalid JSON / wrong distribution | M | M | Zod refine surfaces error → Phase 03 retries once then fails 503. Do NOT loop forever. |
| Prompt drift between providers (Gemini ≠ OpenAI tone) | M | L | Keep system prompt provider-neutral; rely on JSON contract |
| Token overflow on long CV anchor role | L | M | Truncate anchorRole.description to 600 chars before prompt build |
| Verbose prompt degrades output (memory: prompt-engineering discipline) | M | M | Keep prompts < 1.2k tokens system+user before user data |

## Security Considerations
- No PII in prompt logs (do not console.log full prompt with CV data).
- Zod validation prevents injection of unexpected fields into JSONB column downstream.
- LLM output is treated as untrusted — render via React (auto-escape), never `dangerouslySetInnerHTML`.

## Next Steps
- Phase 03 imports both builders + schemas for route handlers.
- Phase 04 imports TS types via `z.infer` for client component props.
