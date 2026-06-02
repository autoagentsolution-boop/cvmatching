# Phase 04 — Cron Refresh + Redirect Tracking + Feedback Endpoint + Cost-Guard Wiring + Admin Dashboard

## Context Links
- Spec: `plans/reports/spec-260529-1031-job-fit-study.md` (Refresh pipeline, Redirect tracking, Feedback)
- Phase 0: cost guard + middleware excludes
- Phase 1: `lib/jobs/repo.ts` (listActive, expireJob, getJob)
- Phase 2: cost recording keys (`metrics:cost:<YMD>:job-recommend`)
- Existing admin: `cv-ex-refactor/src/app/(app)/admin/usage/page.tsx`
- Existing usage read: `cv-ex-refactor/src/lib/usage/read-usage.ts`

## Overview
- **Priority:** P1 — operability + tracking signal
- **Status:** pending
- **Description:** Three new routes (refresh cron, redirect, feedback) + Vercel cron config + admin surfacing of job-recommend metrics + final cost-guard wire-up on the recommend endpoint.

## Key Insights
- Refresh cron is **idempotent** by design: HEADs each `sourceUrl`, marks expired by 404/410/heuristic body match. Auto-expire any `verifiedAt > 21d` regardless of HEAD outcome (defense-in-depth).
- Cron polite-crawl: ≥2000ms delay + ±500ms jitter + custom User-Agent → ~150 jobs × ~2.5s = ~6 min total. **Vercel Pro tier confirmed** → cron `maxDuration = 300s` (5 min) supports single batch of 150 jobs in one tick (~6 min comfortable margin if we reduce sleep to 1500ms for ~3.75 min, or accept ~6 min by splitting batch=120/tick × 2 schedules). **Decision: batch full 150 jobs, single daily schedule 3am ICT, `maxDuration = 300`, sleep 1500±500ms** → ~150 × 2s = ~5 min, fits Pro 300s budget. Cursor field kept as defense-in-depth (resumable if cron truncates).
- Redirect proxy is a tiny KV-incrby route: ~5ms total; the only KV-write needed is the metric.
- Feedback endpoint: 1 KV `lpush` + 1 `incr`; weekly key for dislike rate aggregation.
- Admin dashboard: read `metrics:cost:<YMD>:job-recommend`, `metrics:click:total:<YMD>`, `metrics:refresh:<YMD>` and render under existing usage page.

## Requirements

### Functional
- F1. `GET /api/jobs/refresh` — Vercel cron handler; gated by `Authorization: Bearer ${CRON_SECRET}` header (Vercel sends automatically).
- F2. Refresh logic: for next batch of 50 jobs (rolling pointer in KV `refresh:cursor` to avoid recomputing same 50 each tick): HEAD/GET sourceUrl, classify response → update `verifiedAt` or move to `jobs:expired`. Sleep 2000±500ms between requests.
- F3. Auto-expire: every tick scans `jobs:active`, moves any with `verifiedAt > 21d` to expired (cheap KV scan).
- F4. Log: `metrics:refresh:<YMD>` = `{ ok, expired, errors, batches }` (incr).
- F5. Alert: if `jobs:active` count < 50 → POST `ALERT_WEBHOOK_URL`.
- F6. `GET /api/r/[jobId]`: validate job exists, `incr metrics:click:<jobId>:<YMD>`, `incr metrics:click:total:<YMD>`, 302 to `sourceUrl`, `Cache-Control: no-store`.
- F7. `POST /api/topics/feedback`: zod-parse `{ jobId, topicId, action: 'dislike' }` (no `reason`); `lpush topic-feedback:<topicId> { jobId, ts }`, `incr dislikes:<topicId>:<weekYMD>`.
- F8. Admin usage page surfaces: today's `job-recommend` count, today's cost, today's clicks, refresh stats, top-disliked topics.
- F9. Final cost-guard wire-up in Phase 2 route (confirm not just stub).

### Non-functional
- Refresh cron tick: < 10s wall clock (Vercel hobby tier hard limit).
- Redirect: < 50ms total (no LLM, no embedding load).
- Feedback: < 50ms total.
- Admin page render: < 500ms (KV mget batched).
- All routes excluded from visit-counter (Phase 0 middleware exclude already covers).

## Architecture

### Refresh cron data flow (single tick)

```
GET /api/jobs/refresh (Vercel Cron, single schedule: 3am ICT / 20:00 UTC)
  ├─ verify Authorization: Bearer CRON_SECRET → 401 if mismatch
  ├─ cursor = kv.get('refresh:cursor') || 0     // defense-in-depth resume
  ├─ activeIds = await repo.listActiveIds()
  ├─ batch = activeIds.slice(cursor)             // full remainder, Pro tier 300s allows it
  ├─ for each id in batch:
  │     job = await repo.getJob(id)
  │     try:
  │       res = await fetch(job.sourceUrl, { method: 'HEAD', headers: {UA, timeout: 5s} })
  │       if res.status === 405: res = await fetch(job.sourceUrl, { method: 'GET', ... })
  │       if 404|410: expireJob(id); errors++
  │       elif 200 + body matches /(job|tin tuyển dụng|vị trí).{0,80}(hết hạn|đã đóng|expired)/i: expireJob(id)
  │       elif 200: kv.hset(job:id, { verifiedAt: now }); ok++
  │     catch: errors++
  │     await sleep(1500 + jitter(-500..500))
  │     if (Date.now() - startedAt > 270_000) break   // ~30s safety margin under maxDuration 300s
  ├─ cursor = (lastProcessedIndex + 1) % activeIds.length  // resume next tick if we broke early
  ├─ kv.set('refresh:cursor', cursor)
  ├─ // Auto-expire scan (cheap; runs every tick):
  │   for each id in activeIds: if verifiedAt > 21d: expireJob(id)
  ├─ // Stats:
  │   kv.hincrby('metrics:refresh:<YMD>', 'ok', ok)
  │   kv.hincrby('metrics:refresh:<YMD>', 'expired', expired)
  │   kv.hincrby('metrics:refresh:<YMD>', 'errors', errors)
  ├─ // Pool health:
  │   if activeIds.length - expired < 50: fireWebhook("low_job_pool")
  └─ return { ok, expired, errors, batchSize: batch.length, cursor }
```

### Redirect data flow

```
GET /api/r/[jobId]
  ├─ job = await repo.getJob(jobId)
  ├─ if !job → 404
  ├─ kv.incr('metrics:click:<jobId>:<YMD>') + kv.expire(2 days)
  ├─ kv.incr('metrics:click:total:<YMD>') + kv.expire(2 days)
  └─ NextResponse.redirect(job.sourceUrl, { status: 302, headers: { 'Cache-Control': 'no-store' } })
```

### Feedback data flow

```
POST /api/topics/feedback
  ├─ parse zod { jobId, topicId, action: 'dislike' } — reject 'reason' or extras
  ├─ kv.lpush('topic-feedback:<topicId>', JSON.stringify({ jobId, ts: Date.now() }))
  ├─ kv.ltrim('topic-feedback:<topicId>', 0, 999)  // bounded
  ├─ kv.incr('dislikes:<topicId>:<weekYMD>') + kv.expire(60 days)
  └─ 204 No Content
```

### Admin dashboard surface

```
features/admin/usage-page.tsx or app/(app)/admin/usage/page.tsx (modify)
  fetch /api/admin/usage → { 
    today: {
      jobRecommend: { calls, costMicroUsd },
      clicks: { total, top10ByJob: [{jobId, count}] },
      refresh: { ok, expired, errors, batches }
    },
    topDislikedTopics: [{ topicId, count, weekYMD }]
  }
  render under existing usage tables
```

### Vercel config — `vercel.ts` (TypeScript, replaces deprecated vercel.json)

Requires `npm i -D @vercel/config` (one-time, Phase 4 prereq).

```ts
// cv-ex-refactor/vercel.ts
import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  crons: [
    { path: '/api/jobs/refresh', schedule: '0 20 * * *' }, // 20:00 UTC = 3am ICT, single tick
  ],
};
```

Single schedule because Vercel Pro `maxDuration: 300s` accommodates full 150-job batch in one tick.

## Related Code Files

### New
- `cv-ex-refactor/src/app/api/jobs/refresh/route.ts` (<200 LOC, cron handler)
- `cv-ex-refactor/src/app/api/r/[jobId]/route.ts` (<100 LOC, redirect)
- `cv-ex-refactor/src/app/api/topics/feedback/route.ts` (<100 LOC, feedback POST)
- `cv-ex-refactor/src/lib/jobs/refresh-batch.ts` (<200 LOC, batch refresh helper — pure logic, testable)
- `cv-ex-refactor/src/lib/schemas/topic-feedback-request.ts` (<60 LOC, zod schema)
- `cv-ex-refactor/vercel.ts` (new — TypeScript config; requires `@vercel/config` devDep)

### Modified
- `cv-ex-refactor/src/app/api/jobs/recommend/route.ts` — confirm cost-guard `recordCost` call lands (already in Phase 2 todo, just final audit here).
- `cv-ex-refactor/src/lib/usage/read-usage.ts` — extend aggregation to read `metrics:cost:<YMD>:job-recommend`, `metrics:click:total:<YMD>`, `metrics:refresh:<YMD>`, top disliked topics (kv scan capped at top 10).
- `cv-ex-refactor/src/app/api/admin/export-usage/route.ts` — add job-fit columns (optional; flag if missing).
- `cv-ex-refactor/src/app/(app)/admin/usage/page.tsx` (or its feature file) — render new section "Job Fit & Study".
- `cv-ex-refactor/docs/deployment.md` — runbook entry: cron schedule, CRON_SECRET env, ingest CLI, kill-switch reset.

### Env
- `CRON_SECRET` — Vercel Pro auto-injects; used by refresh route Authorization check.

### DevDep
- `@vercel/config` — required to type `vercel.ts`. Install: `npm i -D @vercel/config` (Phase 4 prereq, runs before any other todo).

## Implementation Steps

1. **Refresh helper.** Create `lib/jobs/refresh-batch.ts`:
   - `async function refreshBatch(ids: string[], opts: { ua: string; timeoutMs: number; sleepMs: number; jitterMs: number }): Promise<{ ok, expired, errors }>`
   - Pure logic; testable with mocked `fetch` + `repo`.
   - Calls `repo.getJob`, `repo.expireJob`, `repo.touchVerifiedAt(id, now)` (add this to repo if not present).
2. **Refresh route.** Create `app/api/jobs/refresh/route.ts`:
   - `runtime = 'nodejs'`, `maxDuration = 300` (Vercel Pro).
   - Verify `Authorization` header equals `Bearer ${env.CRON_SECRET}`.
   - `startedAt = Date.now()`, `cursor = (await kv.get('refresh:cursor')) ?? 0`, `activeIds = await repo.listActiveIds()`.
   - `batch = activeIds.slice(cursor)` (full remainder).
   - `stats = await refreshBatch(batch, { ua: 'ResumeRefineRefreshBot/1.0', timeoutMs: 5000, sleepMs: 1500, jitterMs: 500, deadlineMs: startedAt + 270_000 })`.
   - `refreshBatch` returns `{ ok, expired, errors, lastIndex }` so route knows where to resume.
   - `cursor = lastIndex + 1 >= activeIds.length ? 0 : lastIndex + 1`; `kv.set('refresh:cursor', cursor)`.
   - Auto-expire sweep (verifiedAt > 21d).
   - `kv.hincrby('metrics:refresh:<YMD>', ...)`.
   - If `activeIds.length - expired < 50` → fire webhook "low_job_pool".
   - Return JSON stats.
3. **Redirect route.** Create `app/api/r/[jobId]/route.ts`:
   - `runtime = 'edge'` if Upstash supports it from edge (verify; else `nodejs`).
   - Validate jobId regex (`/^[a-f0-9]{16}$/`).
   - `job = await repo.getJob(jobId)`; 404 if missing.
   - `kv.incr` both keys (fire-and-forget; await with `Promise.allSettled`).
   - `return NextResponse.redirect(job.sourceUrl, 302)` with `Cache-Control: no-store`.
4. **Feedback schema.** Create `lib/schemas/topic-feedback-request.ts`:
   - `z.object({ jobId: z.string().regex(/^[a-f0-9]{16}$/), topicId: z.string().min(1).max(200), action: z.literal('dislike') }).strict()` — strict rejects extra keys (including `reason`).
5. **Feedback route.** Create `app/api/topics/feedback/route.ts`:
   - Parse + validate; on extras → 400.
   - `kv.lpush` + `kv.ltrim` + `kv.incr` + `kv.expire`.
   - Return 204.
6. **Vercel config (TypeScript).** Install `@vercel/config`: `npm i -D @vercel/config`. Create `cv-ex-refactor/vercel.ts` per architecture section (single cron schedule `0 20 * * *`). Type-check via `tsc --noEmit`. `vercel build` picks it up automatically.
7. **Recommend route audit.** Open Phase 2's `app/api/jobs/recommend/route.ts`. Verify `await costGuard.checkKillSwitch('job-recommend')` is the first check after quota and `await costGuard.recordCost('job-recommend', microUsd)` runs in the success path. If Phase 2 PR landed without these, add commit here.
8. **Usage read.** Modify `lib/usage/read-usage.ts`:
   - Extend `readDailyUsage(ymd)` return shape with `jobRecommend: { calls, costMicroUsd }`, `clicks: { total, top10: [{jobId, count}] }`, `refresh: { ok, expired, errors }`.
   - For top-disliked: `kv.scan` `dislikes:*:<weekYMD>`, `mget` counts, top 10.
9. **Admin page section.** Modify `app/(app)/admin/usage/page.tsx` (or its feature wrapper):
   - Add section "Job Fit & Study" below existing tables.
   - Render: today's calls/cost, click leaderboard (top 10 jobs by click), refresh stats card, top disliked topics list.
10. **Deployment doc.** Update `docs/deployment.md`:
    - Cron schedule (single 3am ICT) + Vercel Pro tier confirmed + `maxDuration: 300`.
    - `CRON_SECRET` env (Pro auto-injects).
    - `vercel.ts` requires `@vercel/config` devDep; lint via `tsc --noEmit`.
    - Kill-switch reset: `kv.del('kill-switch:job-recommend')`.
    - Refresh cursor reset: `kv.del('refresh:cursor')`.
    - Ingest CLI runbook (paste/file/stats/expire/rebuild-embeddings).
11. **Compile + smoke.** `npm run build`. Local smoke:
    - `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/jobs/refresh` → returns stats JSON.
    - `curl -I http://localhost:3000/api/r/<known-jobId>` → 302 with `Location` header.
    - `curl -X POST -H "Content-Type: application/json" -d '{"jobId":"a1b2...","topicId":"react-hooks","action":"dislike","reason":"meh"}' http://localhost:3000/api/topics/feedback` → 400 (reason rejected).
    - `curl -X POST ... '{"jobId":"a1b2...","topicId":"react-hooks","action":"dislike"}'` → 204.

## Todo List
- [ ] H4.1 `lib/jobs/refresh-batch.ts` pure helper
- [ ] H4.2 `app/api/jobs/refresh/route.ts` cron handler + auth
- [ ] H4.3 `app/api/r/[jobId]/route.ts` redirect + metric incr
- [ ] H4.4 `lib/schemas/topic-feedback-request.ts` strict zod
- [ ] H4.5 `app/api/topics/feedback/route.ts` POST
- [ ] H4.6 `vercel.ts` (TypeScript config) with single cron schedule; install `@vercel/config` devDep; `tsc --noEmit` passes
- [ ] H4.7 Audit Phase 2 cost-guard wiring (record + check)
- [ ] H4.8 Extend `lib/usage/read-usage.ts` with job-fit keys
- [ ] H4.9 Admin page renders Job Fit section
- [ ] H4.10 `docs/deployment.md` runbook updates
- [ ] H4.11 Compile + local smoke (refresh, redirect, feedback)
- [ ] H4.12 Verify reason field rejected by feedback endpoint

## Success Criteria
- Local refresh route returns stats JSON; cursor advances; verifiedAt updates on at least one known-good URL; one synthetic 404 URL moves to `jobs:expired`.
- Redirect responds 302 with `Cache-Control: no-store` and increments both click counters.
- Feedback responds 204 on valid payload, 400 when `reason` present, 400 when extra keys present.
- Admin page displays today's job-recommend cost and click counts after generating from `/job-fit`.
- `vercel.ts` type-checks (`npx tsc --noEmit`) and `vercel build` recognises the cron schedule.
- `metrics:refresh:<YMD>` hash incremented correctly after one cron tick.
- Pool-low alert fires when `jobs:active` count synthetically < 50.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cron tick exceeds 300s budget (Vercel Pro) | L | M | 150 × 2s = ~5 min. Deadline check breaks loop at 270s; cursor resumes next day from `lastIndex+1`. Worst case: pool refreshed every 2 days instead of 1. |
| Vercel tier downgrade (Pro → Hobby in future) | L | H | Hobby maxDuration = 60s. Document in `deployment.md`: if downgraded, change `maxDuration` + schedule to N ticks/day, batch ≈ ((60-buffer) / 2)s = 25 jobs/tick × 6 ticks. Add migration note. |
| Polite-crawl gets IP-banned by source sites | L | M | Custom UA identifies crawler; 2-5s sleep; honor `robots.txt` (add check); document takedown channel in privacy.md |
| Click metric race (two clicks same ms) | L | L | `kv.incr` is atomic; idempotent |
| User spam-clicks dislike → KV write storm | M | M | Client-side debounce (300ms); server-side rate-limit anon IP for `/api/topics/feedback` (reuse existing IP-rate-limit lib) |
| Auto-expire scan grows with pool size | L | M | Currently O(N) on 150 jobs = 150 KV `hget` per tick → cheap. At 2000+ jobs, swap to indexed `jobs:by-verifiedAt` ZSET (note in spec deferred to v0.3b) |
| Feedback list `topic-feedback:<topicId>` unbounded | L | L | `kv.ltrim` cap at 1000 per topic |
| Admin endpoint surfaces PII | L | H | All metrics keyed by jobId/topicId, never user id; existing admin gate (Phase 0) enforces access |
| Refresh cursor lost (KV eviction) | VL | L | Default to 0; cron resumes from start of list (idempotent) |

## Security Considerations
- `/api/jobs/refresh` MUST verify `Authorization: Bearer ${CRON_SECRET}`. Reject all other requests with 401. Never log the secret.
- `/api/r/[jobId]` MUST validate jobId against `[a-f0-9]{16}` regex — prevents open-redirect via crafted path.
- `/api/r/[jobId]` MUST only redirect to `job.sourceUrl` from KV (not user-supplied target).
- Feedback endpoint MUST use `.strict()` zod schema to reject unknown keys (defense-in-depth against `reason` slipping back in).
- Admin section reads aggregated metrics only; no per-user data exposed.
- Cron route excluded from visit counter (Phase 0 middleware exclude).
- All routes: `runtime = 'nodejs'` unless edge confirmed safe for Upstash + crypto.

## Next Steps
- **Blocks:** Phase 5 (tests + smoke deploy).
- **Depends on:** Phase 0 (cost guard, middleware), Phase 1 (repo), Phase 2 (cost-guard call sites).
- **Co-ships with:** Phase 3 UI (redirect + feedback consumed by UI).
