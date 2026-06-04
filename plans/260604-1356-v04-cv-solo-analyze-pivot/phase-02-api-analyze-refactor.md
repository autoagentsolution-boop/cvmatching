# Phase 2 — API Analyze Refactor (2-Stage Role-Infer + Score)

**Effort:** 3-4h
**Owner:** lead
**Status:** pending
**Blocked by:** phase 1
**Blocks:** phases 3, 6

## Goal

Refactor `/api/analyze` route to drop the JD parameter, add a role-inference stage before scoring, and serve the v3 output schema. Two-stage flow: (1) infer role from CV → if confidence < threshold, return `needsRoleConfirm` for client to surface modal; (2) once role confirmed (auto or user-picked), run scoring with v3 prompt.

## Files to Create

- `src/lib/llm/role-infer.ts` — `inferRoleFromCv(cv: string): Promise<{ canonical, confidence, alternates }>`, ≤ 100 lines
- `src/lib/llm/role-infer-prompt.ts` — small prompt for role extraction, ≤ 50 lines
- `tests/api-analyze-v3.test.ts` — E2E: low-conf path → 200 with needsRoleConfirm; submit with role → full result
- `tests/role-infer.test.ts` — 20 CV fixtures with known target roles; assert ≥85% top-1 accuracy at conf ≥0.75

## Files to Modify

- `src/app/api/analyze/route.ts` — replace JD-comparison flow with 2-stage; return schemaVersion 'v3'
- `src/lib/llm/normalize-analyze.ts` — defer to Phase 7 removal; for now leave alongside v3 normalizer
- `src/lib/quota/consume-quota.ts` — no change (quota 5/day stays per decision #2)

## API Contract

```
POST /api/analyze
  Auth: existing (BYOK / shared-key flow)
  Body: { cvText: string, role?: string }    // role optional — provided after confirm
  
  Response 200 (low confidence, no role given):
    {
      needsRoleConfirm: true,
      candidates: [
        { canonical: 'Senior Backend Engineer', confidence: 0.62 },
        { canonical: 'Tech Lead', confidence: 0.51 },
        { canonical: 'Full-Stack Engineer', confidence: 0.44 },
      ],
      schemaVersion: 'v3',
    }
  
  Response 200 (high confidence OR role provided):
    AnalyzeV3 shape per Phase 1 schema
  
  Response 400: cvText empty / too short (< 100 chars)
  Response 401 / 429 / 5xx: per existing error-surfacing contract
```

Two-call protocol: client first calls without `role`. If `needsRoleConfirm` true, user picks → client calls again with `role` set → bypasses infer, goes straight to scoring.

## Role Inference Implementation

```ts
// role-infer.ts
const ROLE_INFER_SCHEMA = z.object({
  canonical: z.string().max(80),
  confidence: z.number().min(0).max(1),
  alternates: z.array(z.string()).max(3),
});

const CONFIDENCE_THRESHOLD = parseFloat(process.env.ROLE_INFER_CONFIDENCE_THRESHOLD ?? '0.75');

export async function inferRoleFromCv(cv: string, ctx: { llm: LlmClient }): Promise<RoleInferResult> {
  const { system, user } = buildRoleInferPrompt(cv);
  const raw = await ctx.llm.complete({ system, user, schema: ROLE_INFER_SCHEMA, maxRetries: 1 });
  return raw;
}

export function isHighConfidence(result: RoleInferResult): boolean {
  return result.confidence >= CONFIDENCE_THRESHOLD;
}
```

## Route Handler Flow

```ts
// src/app/api/analyze/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  const cvText = String(body.cvText ?? '').trim();
  const role = body.role ? String(body.role).trim() : undefined;

  if (cvText.length < 100) return Response.json({ error: 'cv_too_short' }, { status: 400 });

  const auth = await resolveApiKey(req);
  if (!auth.ok) return errorResponse(auth);

  // Quota check (5/day for analyze)
  const quota = await consumeQuota({ userId: auth.userId, action: 'analyze' });
  if (!quota.ok) return Response.json({ error: 'quota_exceeded' }, { status: 429 });

  const llm = makeLlmClient(auth);

  let targetRole = role;
  if (!targetRole) {
    const infer = await inferRoleFromCv(cvText, { llm });
    if (!isHighConfidence(infer)) {
      return Response.json({
        needsRoleConfirm: true,
        candidates: [{ canonical: infer.canonical, confidence: infer.confidence }, ...infer.alternates.map((c, i) => ({ canonical: c, confidence: Math.max(0, infer.confidence - 0.1 * (i + 1)) }))],
        schemaVersion: 'v3',
      });
    }
    targetRole = infer.canonical;
  }

  const { system, user } = buildAnalyzeV3Prompt(cvText, targetRole);
  const result = await llm.complete({ system, user, schema: AnalyzeV3Schema, maxRetries: 1 });

  await recordCost({ userId: auth.userId, action: 'analyze', tokens: result._meta.tokens });
  return Response.json(result);
}
```

## Implementation Steps

1. Create `role-infer-prompt.ts` with prompt asking Gemini for `{ canonical, confidence, alternates }`. Few-shot 3 examples (clear role, ambiguous, generalist CV).
2. Implement `role-infer.ts` with Zod-validated structured output. Test with 20 fixtures.
3. Refactor route handler:
   - Strip JD parsing
   - Add role-infer step
   - Branch on confidence
   - Call scoring with role
   - Return v3 response
4. Update existing route tests OR add v3 alongside v2 — `tests/api-analyze-v3.test.ts` covers the new path.
5. Verify cost-guard + kill-switch integration unchanged (analyze bucket still applies).
6. Smoke test in preview env: 1 high-conf CV → direct result; 1 ambiguous CV → needsRoleConfirm → submit with role → result.

## Acceptance Criteria

- [ ] Route accepts `{ cvText, role? }`; rejects `jdText` if provided (or silently ignores during transition)
- [ ] Low-confidence CVs return `needsRoleConfirm` with ≥2 candidates
- [ ] High-confidence CVs return full v3 result in one call
- [ ] 20-CV role-infer fixture suite: ≥85% top-1 accuracy at conf ≥0.75
- [ ] Quota check fires correctly (5/day, BYOK exempt)
- [ ] Cost recording per call (both role-infer + scoring counted)
- [ ] Errors surface per [[feedback_error_surfacing_no_silent_fallback]]
- [ ] `pnpm tsc --noEmit` clean
- [ ] vitest passes

## Risks

- **Double LLM call cost**: 2 calls (infer + score) vs v2 single call. Mitigation: role-infer is cheap (~$0.001 vs ~$0.01 scoring); net cost ~10% higher per analyze. Acceptable given activation lift hypothesis.
- **Role inference wrong but confident**: high-conf wrong role → silently scores against wrong target. Mitigation: result UI shows inferred role with "Override" link (Phase 3); user can re-analyze with correct role.
- **Latency increase**: 2 sequential calls add ~1-2s. Mitigation: monitor p95; if > 15s acceptable. Could parallelize speculative score with top-1 role + cancel if user picks different in confirm modal — but speculation burns extra quota. **Defer optimization.**

## Security

- Input validation: `cvText.length < 100` → 400; max length 50KB to prevent prompt-injection bloat
- Role parameter validated against length + character whitelist before injecting into prompt
- No CV content logged to server (existing pattern preserved)

## Next Phase

→ phase-03-ui-analyze-restructure.md
