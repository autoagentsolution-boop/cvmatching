# Phase 01 — DB Migrations + Applied Jobs + Usage Enum

## Context Links
- Memory: `feedback_jwt_auth_fk_upsert_pattern` — `ensureUserRow()` MUST run before every FK insert against `users.id`
- Memory: `feedback_token_tracking_coverage` — add UsageAction enum entries BEFORE writing call sites; audit gap discipline
- Memory: `project_cvmatching_2026_06_10_state` — Phase 8 KV decom shipped, Postgres is canonical
- Related files: `cv-ex-refactor/src/db/schema.ts`, `cv-ex-refactor/src/lib/auth/ensure-user-row.ts`, `cv-ex-refactor/src/lib/usage/types.ts`
- Existing pattern reference: previous Drizzle migrations under `cv-ex-refactor/drizzle/`

## Overview
- **Priority:** P1 (blocks Phases 02-06)
- **Status:** pending
- **Description:** Land DB layer (2 migrations: `applied_jobs` + `interview_sessions`) and the only API route that does NOT need an LLM call: `POST /api/jobs/apply`. Wire Apply button at Job Fit to fire idempotent insert. Extend `UsageAction` enum with two new buckets.

## Key Insights
- `interview_sessions` uniqueness is **filtered**: two partial unique indexes (one for `job_fit` mode where `job_id IS NOT NULL`, one for `standalone` where `job_id IS NULL` using `role_title_hash`). Predicate `WHERE status <> 'abandoned'` allows re-attempt after 24h abandon sweep.
- `role_title_hash` is a STORED generated column — sha256(lower(trim(role_title))) hex — so equality on standalone mode does not depend on whitespace/case.
- `applied_jobs` PK is composite `(user_id, job_id)` so ON CONFLICT DO NOTHING is the idempotent path; no surrogate id needed.
- UsageAction enum buckets must be added FIRST so Phase 03 can reference them without TS errors.

## Requirements
**Functional:**
- 2 migrations apply cleanly forward; rollback scripts produced.
- `POST /api/jobs/apply` returns 204 on success and on duplicate. JWT-protected.
- Apply button at Job Fit result row fires the route (existing button gets onClick handler, no new UI).

**Non-functional:**
- All indexes documented in schema file with rationale comment.
- `ensureUserRow()` runs before insert into `applied_jobs` and (later) `interview_sessions`.
- No schema-side LLM logic.

## Architecture
```
[Job Fit results row]
   └─ <ApplyButton> onClick
         └─ fetch POST /api/jobs/apply { jobId, source: 'job_fit' }
               ├─ auth() → userId
               ├─ ensureUserRow(userId)
               └─ db.insert(applied_jobs).onConflictDoNothing()
                     → 204
```

## Related Code Files
**Create:**
- `cv-ex-refactor/drizzle/00XX_applied_jobs.sql`
- `cv-ex-refactor/drizzle/00XY_interview_sessions.sql`
- `cv-ex-refactor/src/app/api/jobs/apply/route.ts`

**Modify:**
- `cv-ex-refactor/src/db/schema.ts` — add `appliedJobs` + `interviewSessions` table objects + `interviewStatus` pgEnum
- `cv-ex-refactor/src/lib/usage/types.ts` — extend `UsageAction` enum with `InterviewGen = 'interview_gen'` and `InterviewGrade = 'interview_grade'`
- `cv-ex-refactor/src/components/job-fit/apply-button.tsx` — add onClick → POST /api/jobs/apply (idempotent fire-and-forget, toast on error)

**Delete:** none

## Implementation Steps
1. Add `interviewStatus` pgEnum to `schema.ts` with values `('in_progress', 'completed', 'abandoned')`.
2. Add `appliedJobs` table object to `schema.ts` mirroring the SQL DDL (composite PK, `source` text + check constraint, `applied_at` default now).
3. Add `interviewSessions` table object — note `role_title_hash` is a generated column → declare with `.generatedAlwaysAs(sql\`...\`)` if Drizzle supports STORED in this version; if not, write a raw SQL migration step appending the column.
4. Add `idx_applied_jobs_user_recent` and the three interview indexes (`uq_interview_jobfit_active`, `uq_interview_standalone_active`, `idx_interview_user_recent`, `idx_interview_in_progress_for_cron`).
5. Generate Drizzle migrations via `pnpm drizzle-kit generate`. Inspect output SQL — if generated column or partial unique index missing, hand-edit the migration SQL to match the locked DDL exactly.
6. Extend `UsageAction` enum in `src/lib/usage/types.ts`. Update any switch/exhaustive checks (TS compiler will surface them).
7. Create `src/app/api/jobs/apply/route.ts`:
   - `POST` handler, runtime nodejs, `auth()` → userId.
   - Validate body with Zod: `{ jobId: string.min(1), source: z.enum(['job_fit', 'manual']) }`.
   - `await ensureUserRow(userId)`.
   - `db.insert(appliedJobs).values({...}).onConflictDoNothing()`.
   - Return `new Response(null, { status: 204 })`.
8. Modify `apply-button.tsx`: add onClick → fetch; on non-2xx, toast user-facing error; do not block navigation.
9. Run `pnpm tsc --noEmit` and `pnpm drizzle-kit push` against local Postgres to verify schema.
10. Manually verify via psql: insert row twice → second is no-op; partial unique on interview_sessions works after manual test insert.

## Todo List
- [ ] Add interviewStatus enum to schema.ts
- [ ] Add appliedJobs table + indexes to schema.ts
- [ ] Add interviewSessions table + 4 indexes to schema.ts
- [ ] Generate Drizzle migrations and hand-tune SQL for generated column / partial unique
- [ ] Extend UsageAction enum (interview_gen + interview_grade)
- [ ] Create POST /api/jobs/apply route
- [ ] Wire onClick on apply-button.tsx
- [ ] tsc + drizzle-kit push green
- [ ] Manual psql duplicate-insert smoke test

## Success Criteria
- `pnpm drizzle-kit push` applies without error on a fresh DB.
- `INSERT ... ON CONFLICT DO NOTHING` is observable in psql with row count 0 on second call.
- `POST /api/jobs/apply { jobId: 'x', source: 'job_fit' }` returns 204 twice in a row.
- TS compile passes after enum extension.
- Apply button at Job Fit logs success in network tab.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Drizzle does not support STORED generated columns at current version | M | M | Fallback: emit raw SQL ALTER TABLE in migration; document in schema.ts comment |
| Partial unique index syntax differs in Drizzle | M | M | Hand-edit migration SQL; verify with `\d+ interview_sessions` in psql |
| Apply button double-firing creates noise (not data corruption thanks to PK) | L | L | Disable button briefly on click; 204 idempotent anyway |
| ensureUserRow missing — FK 23503 on first-time user from Google sign-in | L | H | Memory `feedback_jwt_auth_fk_upsert_pattern` — call it explicitly in route handler |

## Security Considerations
- JWT-protected route, no public exposure.
- Zod input validation on `jobId` (string min 1) and `source` enum.
- No PII logged; only structured `{ userId, jobId, source }` debug line.
- No user-controlled SQL; Drizzle parameterized inserts.

## Next Steps
- Phase 02 depends on `interview_sessions` table + JSONB shape stability.
- Phase 03 depends on this schema + UsageAction enum entries.
