# Phase 4 Implementation Report
**Date:** 2026-06-02  
**Phase:** phase-04-refresh-feedback-tracking  
**Plan:** plans/260529-1031-job-fit-study/

---

## Phase 2 Cost-Guard Audit (H4.7)

**Finding: ALREADY CORRECTLY WIRED — no changes needed.**

`cv-ex-refactor/src/app/api/jobs/recommend/route.ts`:
- Line 45: `checkKillSwitch('job-recommend')` runs after quota/key resolution, before any LLM or embedding call. Correct.
- Line 140: `recordCost('job-recommend', microUsdCost(...))` runs in success path after `normalizeRecommend` returns matches. Correct.
- Both functions imported from `@/lib/cost/guard`. Wiring was complete in Phase 2.

---

## `@vercel/config` Availability

`npm view @vercel/config version` → `0.5.1` (exists on npm). Installed via pnpm:
```
pnpm add -D @vercel/config   →  + @vercel/config 0.5.1
```
Used `@vercel/config/v1` import path (per package exports map). `vercel.ts` created at `cv-ex-refactor/vercel.ts`.

---

## Files Created

| File | LOC | Notes |
|---|---|---|
| `src/lib/schemas/topic-feedback-request.ts` | 13 | Zod `.strict()` schema — rejects `reason` + any extra key |
| `src/lib/jobs/refresh-batch.ts` | 134 | Pure helper; testable; HEAD→GET fallback; body expiry regex; deadline guard |
| `src/app/api/jobs/refresh/route.ts` | 131 | Cron handler; Bearer auth; auto-expire sweep; KV stats hash; pool-low alert |
| `src/app/api/r/[jobId]/route.ts` | 57 | Redirect; jobId regex; KV incr fire-and-forget; 302 + Cache-Control:no-store |
| `src/app/api/topics/feedback/route.ts` | 61 | POST; zod parse; lpush+ltrim(1000)+incr+expire; 204 |
| `cv-ex-refactor/vercel.ts` | 20 | `@vercel/config/v1` VercelConfig; single cron `0 20 * * *` |
| `src/lib/usage/read-job-fit-stats.ts` | 129 | Separated from read-usage.ts to honour 200 LOC limit; kv.scan for click+dislike top-10 |
| `src/app/(app)/admin/usage/job-fit-stats-section.tsx` | 118 | Server component; renders cost, clicks, refresh stats, top-disliked topics |

---

## Files Modified

| File | Delta | Change |
|---|---|---|
| `src/lib/jobs/repo.ts` | +10 | Added `touchVerifiedAt(id, isoTimestamp)` |
| `src/lib/env.ts` | +3 | Added `CRON_SECRET: z.string().min(16).optional()` |
| `src/lib/usage/read-usage.ts` | 0 net | Reverted attempted inline addition (kept file at 164 LOC); job-fit stats moved to dedicated file |
| `src/app/(app)/admin/usage/page.tsx` | +7 | Added 3 imports + `todayYmd`/`jobFitStats` fetch calls + `<JobFitStatsSection>` |
| `cv-ex-refactor/.env.example` | +5 | Added `CRON_SECRET=` with comment |
| `docs/deployment.md` | +65 | Replaced pseudocode §12 with full Phase 4 runbook: cron schedule, env vars, ingest CLI, kill-switch reset, cursor reset, admin dashboard |

---

## Build Result

```
✓ Compiled successfully in 9.2s
✓ TypeScript passed
✓ 25/25 static pages generated
All routes present: /api/jobs/refresh, /api/r/[jobId], /api/topics/feedback
```

One type error fixed during build: `ids[i]` typed as `string | undefined` in for-loop → cast to `string` with `ids[i] as string` (array is `string[]` from `listActiveIds`, cast is safe).

---

## Test Results

```
Test Files  6 passed (6)
    Tests  28 passed (28)   ← same count as before; no regressions
  Duration  485ms
```

---

## Smoke Results (H4.11 + H4.12)

| Test | Command | Response | Status |
|---|---|---|---|
| Refresh — no auth | `GET /api/jobs/refresh` | `401 {"code":"unauthorized"}` | PASS |
| Refresh — wrong Bearer | `GET /api/jobs/refresh` + wrong header | `401 {"code":"unauthorized"}` | PASS |
| Refresh — correct Bearer | `GET /api/jobs/refresh` + correct | `503 {"code":"service_unavailable","message":"KV not configured."}` — auth passes, KV guard fires | PASS |
| Redirect — invalid hex | `GET /api/r/notavalidhex` | `400 {"code":"invalid_job_id"}` | PASS |
| Redirect — uppercase hex | `GET /api/r/AAAAAAAAAAAAAAAA` | `400 {"code":"invalid_job_id"}` | PASS |
| Redirect — valid hex, no KV | `GET /api/r/aaaaaaaaaaaaaaaa` | `503 {"code":"service_unavailable","message":"KV not configured."}` | PASS |
| Feedback — valid payload | `POST /api/topics/feedback` `{jobId,topicId,action}` | `204` | PASS |
| Feedback — with `reason` field | Same + `"reason":"meh"` | `400 Unrecognized key: "reason"` | PASS |
| Feedback — missing action | Same without `action` | `400 action: Invalid input` | PASS |

Notes:
- CRON_SECRET set in `.env.local` (gitignored via `**/.env.*` in root `.gitignore`) as `local-smoke-test-secret-phase4`.
- KV not available in local env — redirect and refresh KV paths correctly fail with 503 rather than 500.
- Redirect 302 path will work only with KV configured (Vercel prod or local with KV creds).

---

## Todo Status

- [x] H4.1 `lib/jobs/refresh-batch.ts` pure helper
- [x] H4.2 `app/api/jobs/refresh/route.ts` cron handler + auth
- [x] H4.3 `app/api/r/[jobId]/route.ts` redirect + metric incr
- [x] H4.4 `lib/schemas/topic-feedback-request.ts` strict zod
- [x] H4.5 `app/api/topics/feedback/route.ts` POST
- [x] H4.6 `vercel.ts` TypeScript config; `@vercel/config` installed; build passes
- [x] H4.7 Phase 2 cost-guard audit — already correctly wired; no changes needed
- [x] H4.8 Job-fit stats reader created (`read-job-fit-stats.ts`); `read-usage.ts` unchanged
- [x] H4.9 Admin page renders Job Fit section via `job-fit-stats-section.tsx`
- [x] H4.10 `docs/deployment.md` runbook updated (§12 fully replaced)
- [x] H4.11 Compile + local smoke pass
- [x] H4.12 `reason` field rejected by feedback endpoint (400)

---

## Deviations from Plan

| Deviation | Justification |
|---|---|
| `read-job-fit-stats.ts` created as new file instead of extending `read-usage.ts` | `read-usage.ts` was already 164 LOC; extension would exceed 200 LOC limit. New file respects file-size rule. |
| `job-fit-stats-section.tsx` extracted from `page.tsx` | `page.tsx` was already 241 LOC; adding section inline would exceed 200 LOC. Component extraction is the DRY approach. |
| Redirect returns 503 (not 404) when KV unavailable | `assertKv()` in `repo.ts` throws if KV not configured. Added explicit `!kvAvailable → 503` guard before `getJob` call to avoid 500. The 503 message is actionable; matches error surfacing policy. |
| `vercel.ts` uses `@vercel/config/v1` not `@vercel/config` | Package exports only `./v1` subpath. No `/v1` suffix would fail at compile time. |
| Admin page `jobRecommend.calls` field not populated from cost key | The cost key (`metrics:cost:<ymd>:job-recommend`) is a sum in microUSD, not a call counter. A separate call counter key was not written in Phase 2. The admin section shows cost display correctly; calls field is omitted from `JobFitStats` type to avoid misleading data. |

---

## Status

**Status:** DONE_WITH_CONCERNS  
**Summary:** All H4.1–H4.12 implemented; build clean; 28/28 tests pass; all smoke tests pass.  
**Concerns:**
1. `jobRecommend.calls` count is not available — Phase 2 only writes cost microUSD, not a separate call counter. Admin section shows cost correctly but call count is absent. Low priority; can add `hincrby metrics:recommend-calls:<ymd>` in Phase 2 route if needed.
2. `kv.scan` for top-10 clicks is O(N) on all KV keys matching pattern. At 150 jobs this is acceptable (~150 keys). At 2000+ jobs, replace with a ZSET leaderboard (documented in code comment and deferred per plan risk table).
3. `.env.local` has `CRON_SECRET=local-smoke-test-secret-phase4` appended for smoke testing. This is gitignored. Must not be committed (verified gitignore covers it).
