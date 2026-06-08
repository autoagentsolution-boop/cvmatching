# Phase 3 — Refined CV: ATS Keywords + Voice Preservation + Interview Prep

**Priority:** P1 — biggest single feature add (interview prep)
**Status:** Not started (depends on Phase 1 schema patterns)
**Estimated effort:** 0.5 day

## Context

- Audit: `plans/reports/researcher-260608-1235-llm-prompts-audit.md`
- Current Refined CV: Markdown output split by `<!--REFINE-NOTES-->` separator
- `mustHaves[]` exists on PG `jobs` rows since v0.4 — refined CV does NOT use them
- Refine Notes today only has "Changes Made" + "Gaps To Address" — limited value

## Insight

Refined CV today is **cosmetic**: it rewords bullets. Three concrete upgrades shift it to **interview prep + ATS optimization + self-awareness tool**:

1. **ATS inject** — force LLM to use real JD must-haves verbatim (closes ATS gap, fixes "doesn't rank in HR ATS keyword scan" pain)
2. **Voice preservation** — explicit instruction to match candidate's original tone (today LLM tends to flatten to generic recruiter-speak)
3. **Interview prep block** — new Refine Notes section: 3 questions the candidate WILL be asked + honest prep — turns refined CV from cosmetic into prep tool

## Requirements

Functional:
- Pre-LLM step: extract `mustHaves[]` from JD (if v3 mode + job has mustHaves) OR parse top-10 keywords from JD text (v2 mode)
- Prompt rule: `MUST USE these N keywords verbatim somewhere in CV body: [...]`
- Voice preservation rule: `Match candidate's original tone. If they wrote "I built", do not switch to passive "was built". If terse, stay terse.`
- Block 2 (RefineNotes) restructured into 3 labeled sections (h3 each):
  - `### What recruiter sees` — 3-sentence recruiter-eye snapshot of THIS refined CV
  - `### What I padded vs what's real` — auto-confess which bullets were rephrased to sound bigger (so user can revert easily)
  - `### 3 interview questions you WILL be asked + honest prep` — gap-attack angle (1-2 sentence prep per question)

Non-functional:
- Token cost: +500 output for interview prep, +200 input for keywords ≈ +5% per call
- Markdown output format preserved (no JSON migration)
- Backwards-compat: separator `<!--REFINE-NOTES-->` unchanged; old RefineNotes sections may coexist during transition

## Architecture

```
Refined CV flow (existing + new):
  1. POST /api/generate-cv with body {cvText, jdText OR findings, jobId?, mode, tone, length}
  2. NEW: if jobId present → fetch mustHaves[] from PG
     ELSE: tiny LLM call OR regex pass over jdText → top-10 keywords
  3. Build prompt: inject required keywords + voice rule + new RefineNotes structure
  4. LLM call (UNCHANGED — Gemini, temp 0.3, 16K tokens, thinking disabled)
  5. Split by separator → Block 1 (CV) + Block 2 (3-section RefineNotes)
  6. UI: render Block 1 in download-ready pane, Block 2 in collapsible coaching pane
```

## Related code files

To modify:
- `src/lib/llm/prompt-generate-cv.ts` — add keyword inject placeholder, voice rule, new RefineNotes structure
- `src/app/api/generate-cv/route.ts` — pre-LLM keyword extraction step (PG fetch or LLM call)
- `src/lib/llm/extract-ats-keywords.ts` (new ≤80 lines) — fallback keyword extractor when no jobId present
- UI Refined CV view — render 3-section RefineNotes with clear visual hierarchy (defer to UI/UX refactor)

## Implementation steps

1. Edit `prompt-generate-cv.ts`:
   - Add `${requiredKeywords}` placeholder near "=== JOB DESCRIPTION ===" block
   - Add HARD RULE: `MUST USE these N keywords verbatim somewhere in CV body: [...]`
   - Add HARD RULE: voice preservation
   - Restructure Block 2 spec — 3 h3 sections explicitly named
2. Modify route handler:
   - If `body.jobId` present: fetch `mustHaves[]` from PG `jobs` row
   - Else: call `extractAtsKeywords(jdText)` (new util, can use regex on bullet patterns OR mini-LLM call)
   - Pass keywords into prompt builder
3. Write `extractAtsKeywords` util — simple version: regex over JD looking for capitalized tech terms, frameworks list, years-of-X patterns; fall back to top-10 by frequency
4. Update mode instructions to factor interview prep angle: `apply` mode → confident questions; `fill-gaps` mode → defensive prep; `stretch` mode → "why are you applying" angle
5. Smoke test with real CV + real JD, verify all 3 new sections appear, keywords present in CV body
6. UI render — coordinate with UI/UX refactor

## Todo

- [ ] Edit `prompt-generate-cv.ts` — keyword inject + voice rule + 3-section RefineNotes
- [ ] Modify route handler — fetch mustHaves OR call extractor
- [ ] Write `extractAtsKeywords.ts` util
- [ ] Mode-specific interview prep angle tuning
- [ ] Smoke test: verify 3 new sections in output
- [ ] Smoke test: verify keywords actually present in Block 1 CV body (regex check)
- [ ] UI 3-section render (depends on UI/UX refactor)

## Success criteria

- Refined CV Block 1 contains ≥80% of injected keywords verbatim
- Refined CV Block 2 has all 3 new sections present
- Interview prep questions are role-specific (not generic "tell me about yourself")
- Voice preservation: spot check sample outputs — first-person stays first-person, terse stays terse

## Risks

- **Keyword stuffing** — LLM jams keywords unnaturally. Mitigation: prompt rule `integrate naturally, not list-stuffed; if a keyword does not fit a real bullet, omit it AND note in "Changes Made"`
- **Interview questions generic** — mitigation: explicit prompt rule `questions must target the CV's weakest evidence dimension, not "tell me about yourself"`
- **Markdown parser breaks** on new h3 section names — mitigation: keep separator unchanged, test split logic with new content shape

## Security

- Keyword extractor runs on JD text (operator-curated, low risk)
- No new user input paths
- mustHaves field is operator-curated at ingest

## Dependencies

- BLOCKED ON: Phase 1 (dual-lens schema patterns in normalize layer)
- SOFT DEP ON: Phase 2 (pool grounding) — if Phase 2 ships first, keyword extractor can reuse `jobs-by-role` helper for relevant context

## Next steps

→ Validate full workflow end-to-end with 3 real CV samples (different seniority levels)
→ Measure: does interview prep block actually help? Solicit feedback before extending to Roadmap.
