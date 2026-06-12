# Phase 06 — Tests + E2E Checklist

## Context Links
- Memory: `feedback_no_auto_llm_calls` — testers MUST verify no useEffect → fetch path for start/submit
- Memory: `feedback_error_surfacing_no_silent_fallback` — explicit 402/409/503 tests; no heuristic-fallback assertion
- Memory: `feedback_token_tracking_coverage` — verify `llm_usage_log` rows after both LLM calls
- Memory: `project_cvmatching_2026_06_10_state` — 608 tests passing baseline; add ~25-35 new tests
- Related files: existing `cv-ex-refactor/src/**/*.test.ts` patterns, `cv-ex-refactor/vitest.config.ts`

## Overview
- **Priority:** P1 (gates merge)
- **Status:** pending
- **Description:** Author unit tests (Zod schemas, storage CRUD, unique-constraint logic, abandon sweep), integration tests (API routes with mocked LLM), and a manual E2E checklist. Delegate full run to `tester` agent at end.

## Key Insights
- LLM calls in integration tests are mocked at the `callLLM`/`callLLMWithFallback` boundary — never hit real provider in CI.
- Unique-constraint logic has 4 branches: job_fit-active-exists, job_fit-no-active, standalone-active-exists, standalone-no-active. All 4 tested.
- Manual E2E catches what unit tests cannot: stable JSX tree behavior, no-auto-LLM-fire, locale switching, BYOK CTA rendering.
- 24h abandon cron test uses synthetic `created_at` (insert with past timestamp), assert update flips status.

## Requirements
**Functional:**
- All new code has unit tests (storage, schemas, unique-check, abandon-sweep).
- All 5 API routes have integration tests with mocked LLM (happy + error paths).
- Manual E2E checklist passes end-to-end on local dev.

**Non-functional:**
- Tests use real Postgres (test schema), not mocked DB — consistent with project convention.
- LLM mocked at module boundary, not at HTTP layer.
- Total runtime under 90s additional for new tests.

## Architecture
```
Unit tests
  src/lib/llm/schemas-interview.test.ts             — valid + invalid Zod fixtures
  src/lib/interview/storage.test.ts                 — Drizzle CRUD round-trips
  src/lib/interview/unique-constraint-check.test.ts — 4 branches
  src/lib/interview/abandon-sweep.test.ts           — synthetic stale rows → flipped

Integration tests (with test DB)
  src/app/api/jobs/apply/route.test.ts              — 204 + idempotent
  src/app/api/interview/start/route.test.ts         — 200 / 402 / 409 / 503
  src/app/api/interview/submit/route.test.ts        — 200 + ownership 404 + status 409
  src/app/api/interview/[id]/route.test.ts          — 200 + 404-not-owner
  src/app/api/interview/history/route.test.ts       — 200 with limit
  src/app/api/cron/interview-abandon/route.test.ts  — 200 with secret + 401 without

Manual E2E checklist (Phase 06.md anchor — humans run)
```

## Related Code Files
**Create:**
- `cv-ex-refactor/src/lib/llm/schemas-interview.test.ts`
- `cv-ex-refactor/src/lib/interview/storage.test.ts`
- `cv-ex-refactor/src/lib/interview/unique-constraint-check.test.ts`
- `cv-ex-refactor/src/lib/interview/abandon-sweep.test.ts`
- `cv-ex-refactor/src/app/api/jobs/apply/route.test.ts`
- `cv-ex-refactor/src/app/api/interview/start/route.test.ts`
- `cv-ex-refactor/src/app/api/interview/submit/route.test.ts`
- `cv-ex-refactor/src/app/api/interview/[id]/route.test.ts`
- `cv-ex-refactor/src/app/api/interview/history/route.test.ts`
- `cv-ex-refactor/src/app/api/cron/interview-abandon/route.test.ts`

**Modify:** none
**Delete:** none

## Implementation Steps
1. **Zod schema tests** — write 2 valid + 4 invalid fixtures per schema (wrong count, wrong type dist, missing field, wrong score).
2. **storage.test.ts** — round-trip insert/select/update; verify generated `role_title_hash` matches sha256(lower(trim)) for VI/EN strings.
3. **unique-constraint-check.test.ts** — seed DB with sessions across all 4 branches; assert findActiveSessionByUniqueKey returns correct row.
4. **abandon-sweep.test.ts** — seed 3 in-progress rows: one 25h old, one 23h old, one completed. Run `markAbandoned()` → assert only 25h-old row flipped.
5. **jobs/apply route test** — call POST twice with same body, assert both 204 + only 1 row in DB.
6. **interview/start route tests** (mock callLLM):
   - happy: returns 200 + sessionId + dualLens + 10 stripped questions (no rubric in response)
   - 402: no BYOK key → error JSON with `BYOK_MISSING`
   - 409: pre-seed active session → returns existing sessionId + `resume_existing`
   - 503: mock callLLM throws → classified 503
   - assert `llm_usage_log` row inserted with `action='interview_gen'`
7. **interview/submit route tests** (mock callLLM):
   - happy: provide 10 answers → returns overallScore + gradedQuestions; verify questions JSONB has user_answer + grade merged
   - 404: different user's sessionId → 404
   - 409: status='completed' → 409 SESSION_NOT_IN_PROGRESS
   - 502: mock LLM returns invalid grade JSON → 502
   - assert `llm_usage_log` row for `interview_grade`
8. **interview/[id] route test** — owner gets 200, non-owner gets 404 (not 403).
9. **interview/history route test** — seed 12 sessions, request limit=10 → returns 10 in DESC order.
10. **cron/interview-abandon route test** — without secret header → 401; with secret → 200 + count.
11. Run `pnpm test` — entire suite green.
12. Manual E2E checklist (humans):
    - [ ] Login as test user with BYOK gemini key
    - [ ] Apply for a job from Job Fit → verify row in `applied_jobs`
    - [ ] Click "Interview Practice" CTA from chevron → lands on /interview?jobId=X
    - [ ] Pick anchor role → click "Start interview" — verify LLM fires ONLY on click (not on page load — check Network tab)
    - [ ] Lands on /interview/[id], sees Dual Lens + 10 Q
    - [ ] Type 1 char in any answer → state changes from `empty` to `typing` → element does NOT remount (textarea retains focus)
    - [ ] Answer all 10 Q → "Submit" button enables
    - [ ] Click Submit → grading toast → results page
    - [ ] Results page shows overall score, 4 quadrants, 10 graded Q
    - [ ] Switch locale VI ↔ EN → UI strings change, LLM content stays in original locale (or re-fires only on next session)
    - [ ] Refresh dashboard → history widget shows the session
    - [ ] Delete BYOK key from Settings → start new session → 402 CTA appears → "Open Settings" link works
    - [ ] Manually update one session row to `created_at = now() - '25 hours'` and `status='in_progress'`; curl cron endpoint with secret → assert `updated=1`
13. Delegate full test suite execution to `tester` agent. If any fail, fix and re-run.

## Todo List
- [ ] Author 4 unit test files
- [ ] Author 6 integration test files
- [ ] All tests green: `pnpm test`
- [ ] Manual E2E checklist 13 items
- [ ] No auto-LLM-fire verified via Network tab
- [ ] BYOK 402 CTA verified
- [ ] Cron flips 24h+ session
- [ ] Delegate to tester agent for final run
- [ ] Mark plan complete only when all 608+ tests pass

## Success Criteria
- All new tests green; existing 608+ tests still green.
- Manual E2E checklist: every box ticked.
- Tester agent reports DONE (not DONE_WITH_CONCERNS).
- No silent fallback observed in any error path.
- Token logging rows confirmed in `llm_usage_log`.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mocked LLM tests pass but real provider returns invalid JSON | M | M | Manual E2E with real gemini key catches; document in checklist |
| Test DB schema drift if Phase 01 migration not run before tests | M | M | Test setup runs `drizzle-kit push` first; CI enforces |
| Flaky abandon-sweep test due to clock skew | L | L | Use explicit `created_at` value; not `now() - interval` |
| useEffect auto-fire regression slips past unit tests | M | H | Manual Network-tab check is the only reliable signal; checklist mandatory |
| Tester agent reports concerns but plan marked done | L | M | Lead reviews tester output before marking complete |

## Security Considerations
- Test fixtures use synthetic emails (`+test@`); no real PII.
- Tests never hit real LLM provider — no key spend.
- Cron secret in test = `process.env.CRON_SECRET_TEST`, not production secret.

## Next Steps
- Post-merge: monitor Vercel logs for 1 week, watch for unexpected 503 / 402 spikes.
- v2 backlog: refined CV anchor, billing integration, PDF export, share links, re-roll.
