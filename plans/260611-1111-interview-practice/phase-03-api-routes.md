# Phase 03 — API Routes (start, submit, [id], history, cron)

## Context Links
- Memory: `feedback_error_surfacing_no_silent_fallback` — 402/409/503 must surface with actionable messages, NO silent heuristic fallback
- Memory: `feedback_token_tracking_coverage` — `logLlmCall(userId, action, tokens)` at BOTH LLM call sites
- Memory: `feedback_jwt_auth_fk_upsert_pattern` — `ensureUserRow()` before insert into `interview_sessions`
- Memory: `feedback_no_auto_llm_calls` — these routes are LLM-consuming; both MUST be triggered by explicit user click in Phase 04 UI
- Memory: `project_cvmatching_2026_06_10_state` — `callLLMWithFallback` chain exists for Gemini (503 → openai → anthropic); reuse it
- Related files: `cv-ex-refactor/src/lib/llm/call-llm.ts`, `cv-ex-refactor/src/lib/llm/call-llm-with-fallback.ts`, `cv-ex-refactor/src/lib/usage/log-llm-call.ts`, `cv-ex-refactor/src/lib/auth/ensure-user-row.ts`, `cv-ex-refactor/src/lib/settings/get-byok-key.ts` (or equivalent)

## Overview
- **Priority:** P1 (blocks Phase 04 + 06)
- **Status:** pending
- **Description:** Land all 5 API routes. BYOK gating (402), unique-session detection (409 with resume sessionId), provider down (503 via fallback chain). Token logging at both LLM sites. Cron handler stub here (wiring in Phase 05).

## Key Insights
- BYOK key is provider-scoped. If user picks `gemini` but only has `openai` key in Settings → 402 with clear "missing gemini key" message.
- 409 on existing active session is RESUMABLE — return existing `sessionId` so UI can route the user to `/interview/[id]` instead of erroring.
- `/api/interview/[id]` returns 404 (not 403) when session.user_id ≠ current user, to prevent info-leak about session existence.
- Submit route MUST verify all 10 answers present + IDs match generated questions (defensive — UI should enforce, but defense in depth).
- Grade route updates `questions` JSONB via merge — preserve original `question` + `rubric`, attach `user_answer` + `grade` per Q.

## Requirements
**Functional:**
- `POST /api/interview/start` — gate BYOK, check unique, call LLM (with fallback if gemini), persist session, return 200.
- `POST /api/interview/submit` — auth check session ownership, validate 10 answers, call grade LLM, merge into JSONB, set `overall_score` + `status='completed'` + `submitted_at`/`graded_at`.
- `GET /api/interview/[id]` — return full session JSON; 404 if not owner.
- `GET /api/interview/history?limit=10` — recent sessions for the dashboard widget.
- `POST /api/cron/interview-abandon` — Vercel cron handler.

**Non-functional:**
- All routes runtime `nodejs`, `preferredRegion='sin1'` for read paths.
- All routes JWT-protected except cron (Vercel cron secret header check).
- All Zod-validate request bodies.
- All wrap LLM calls in try/catch with classified error mapping.

## Architecture
```
POST /interview/start
   auth() → userId
   ensureUserRow(userId)
   validate body (Zod)
   check BYOK key for provider → 402 if missing/invalid format
   query existing active session (uq_interview_jobfit_active OR uq_interview_standalone_active)
     → if exists → 409 { sessionId, message: 'resume_existing' }
   build prompt-interview-gen (locale from headers / user pref)
   callLLMWithFallback(provider, {...})        // gemini → openai → anthropic
   parse → interviewGenOutputSchema
   logLlmCall(userId, 'interview_gen', tokens)
   db.insert(interview_sessions) with dual_lens + questions JSONB
   return 200 { sessionId, dualLens, questions: <strip rubric> }   // rubric stays server-side
```
```
POST /interview/submit
   auth → ownership check (404 if not owner)
   validate body: { sessionId, answers: array.length(10) }
   verify session.status === 'in_progress'
   build prompt-interview-grade
   callLLM (no fallback chain — single batched call; if fails, classify)
   parse → interviewGradeOutputSchema
   logLlmCall(userId, 'interview_grade', tokens)
   merge grades into questions JSONB
   compute overall_score = avg(scores) * 10/3, round 1dp
   db.update SET questions=..., overall_score=..., status='completed', submitted_at=now(), graded_at=now()
   return 200 { overallScore, gradedQuestions }
```

## Related Code Files
**Create:**
- `cv-ex-refactor/src/lib/interview/storage.ts` — Drizzle CRUD helpers (`createSession`, `getSessionById`, `updateGrades`, `listUserHistory`, `findActiveSessionByUniqueKey`)
- `cv-ex-refactor/src/lib/interview/unique-constraint-check.ts` — pre-insert lookup by either uniqueness predicate
- `cv-ex-refactor/src/lib/interview/abandon-sweep.ts` — pure DB function `markAbandoned()` called by cron handler in Phase 05
- `cv-ex-refactor/src/app/api/interview/start/route.ts`
- `cv-ex-refactor/src/app/api/interview/submit/route.ts`
- `cv-ex-refactor/src/app/api/interview/[id]/route.ts`
- `cv-ex-refactor/src/app/api/interview/history/route.ts`
- `cv-ex-refactor/src/app/api/cron/interview-abandon/route.ts`

**Modify:** none in this phase (Phase 04 wires UI to these routes)
**Delete:** none

## Implementation Steps
1. Author `src/lib/interview/storage.ts`:
   - `createSession(params)` — insert + return inserted row.
   - `getSessionById(id, userId)` — returns row or undefined; enforces ownership.
   - `findActiveSessionByUniqueKey({ userId, jobId?, roleTitleHash?, anchorRoleId })` — selects by predicate matching the partial unique indexes.
   - `updateGrades(sessionId, { questions, overallScore })`.
   - `listUserHistory(userId, limit)`.
   - File < 200 lines.
2. Author `src/lib/interview/unique-constraint-check.ts` — thin wrapper that computes `role_title_hash` for standalone mode and dispatches to `findActiveSessionByUniqueKey`. Returns `null` or `{ sessionId }`.
3. Author `src/lib/interview/abandon-sweep.ts` — pure function `markAbandoned()` that runs the UPDATE statement and returns row count. No request handling here.
4. Author `POST /api/interview/start/route.ts`:
   - Zod schema for body: `{ mode: enum, jobId?: string, roleTitle?: string, anchorRoleId: string, provider: enum }`. Cross-field refine: jobId required when mode=job_fit, roleTitle required when standalone.
   - `auth()` → userId; `ensureUserRow`.
   - BYOK lookup — if not present for provider, return 402 with `{ error: 'BYOK_MISSING', message: 'Cần nhập API key trong Settings cho <provider>' }`.
   - Unique check → if active session, return 409 `{ sessionId, message: 'resume_existing' }`.
   - Load anchor role from CV (existing CV fetcher) — truncate description to 600 chars.
   - For job_fit mode: load JD snippet from existing Job Fit cache/table.
   - Build prompt via `buildInterviewGenPrompt`.
   - `provider === 'gemini'` → `callLLMWithFallback`; else → direct `callLLM`.
   - Parse via `interviewGenOutputSchema`. On parse error: log + return 503 `{ error: 'LLM_BAD_OUTPUT' }`.
   - `logLlmCall(userId, UsageAction.InterviewGen, { promptTokens, completionTokens })`.
   - Insert via `createSession`. Catch unique-violation race → fetch existing → return 409.
   - Return 200 `{ sessionId, dualLens, questions: questions.map(q => ({ id, type, question })) }` — STRIP rubric from response.
5. Author `POST /api/interview/submit/route.ts`:
   - Zod body: `{ sessionId: uuid, answers: array.length(10) of { id, answer: string.min(1) } }`.
   - Load session via `getSessionById(sessionId, userId)` → 404 if missing/owner mismatch.
   - Verify `status === 'in_progress'` → else 409 `{ error: 'SESSION_NOT_IN_PROGRESS' }`.
   - Verify answer IDs match question IDs.
   - Build prompt via `buildInterviewGradePrompt(session.questions, answers, locale)`.
   - `callLLM` (no fallback — single-shot batched). Classify errors: 503 if upstream, 502 if parse error.
   - `logLlmCall(userId, UsageAction.InterviewGrade, tokens)`.
   - Merge grades into `questions` JSONB; compute `overallScore`.
   - `updateGrades(sessionId, ...)`.
   - Return 200 `{ overallScore, gradedQuestions }`.
6. Author `GET /api/interview/[id]/route.ts` — load via `getSessionById`; 404 if not owner; return full session JSON (still strip rubric for the client).
7. Author `GET /api/interview/history/route.ts` — `listUserHistory(userId, limit)` with Zod query parsing for `limit` (default 10, max 50). Return slim fields only.
8. Author `POST /api/cron/interview-abandon/route.ts` stub — header check `Authorization: Bearer <CRON_SECRET>` → call `markAbandoned()` → return `{ updated: <count> }`. Cron entry added in Phase 05.
9. Run `pnpm tsc --noEmit` + `pnpm test` (existing baseline).
10. Manual curl tests for each route documented in Phase 06 E2E checklist.

## Todo List
- [ ] storage.ts CRUD helpers (5 functions)
- [ ] unique-constraint-check.ts
- [ ] abandon-sweep.ts pure function
- [ ] POST /api/interview/start with all error paths (402/409/503)
- [ ] POST /api/interview/submit with ownership + status + answer ID validation
- [ ] GET /api/interview/[id] with 404-on-not-owner
- [ ] GET /api/interview/history?limit
- [ ] POST /api/cron/interview-abandon with secret header check
- [ ] logLlmCall wired at both LLM sites
- [ ] tsc + tests green

## Success Criteria
- All 5 routes respond with correct status code matrix (200/204/402/404/409/503) per design.
- `logLlmCall` rows visible in `llm_usage_log` table after manual e2e.
- 9-dim BYOK 402 message visible to user when key missing.
- Unique-constraint race produces clean 409 (not 500).
- No silent fallback to heuristic; every error path returns structured error JSON.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unique-index race condition: two concurrent starts | L | M | Catch unique-violation in DB error → re-query → return 409 |
| Grade LLM emits 10 grades but wrong IDs | M | M | Match by index AND validate ID set equals question ID set; fail 502 if mismatch |
| BYOK key validation only catches missing, not "wrong key" | M | M | First LLM call surfaces 401/403 from provider → classify as 402 BYOK_INVALID |
| Cron secret leak | L | H | Use Vercel cron header `x-vercel-cron`; double-check with shared secret |
| `interview_gen` returns 503 in middle of chain — partial cost incurred | M | L | Acceptable in BYOK (user pays); document in Phase 05 metrics TODO |

## Security Considerations
- All routes JWT-protected except cron (header secret).
- Zod validates all bodies.
- 404 (not 403) on ownership mismatch in `/[id]` to prevent existence-leak.
- Rubric NEVER returned to client (would let user game answers).
- BYOK key never logged.
- Cron handler check `x-vercel-cron: 1` header AND shared `CRON_SECRET` env.

## Next Steps
- Phase 04 consumes these routes from the UI.
- Phase 05 adds `vercel.json` cron entry pointing to `/api/cron/interview-abandon`.
- Phase 06 writes unit tests for `storage.ts` + integration tests for routes.
