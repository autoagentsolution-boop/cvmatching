# Phase 07 — Refresh Dedup + "No More Matches" UX

## Context Links

- Recommend route + seen-store: Phase 04
- Schema: Phase 01 `user_seen_job` table
- UI: existing `src/app/job-fit/*` pages

## Overview

- Priority: P2
- Status: pending
- Effort: 3-4h
- Blocks: full launch polish
- Blocked by: 04

Wire up the per-user persistent dedup (signed-in → DB) + per-session client dedup (anon → sessionStorage). Surface a "no more new matches — broaden search" CTA when the user has seen everything in their vertical pool. Add an admin reset action for QA.

## Key Insights

- Signed-in: server-side `excludeForUserId` already implemented in Phase 04 — this phase adds the UX response when zero results return after dedup.
- Anon: client maintains `seenIds` in sessionStorage; passes up to last 50 in body each request.
- "No more matches" detection: if `topKByEmbedding` returns < requested K AND post-LLM `applyTierGate` yields 0 jobs, AND the cause is dedup (not pool emptiness), surface a specific CTA.
- Reset-seen admin action: useful for QA to re-test the same CV without burning fresh ingest.
- Persistent TTL: default 90 days (sliding window). After 90d, a seen-job becomes "stale" and can resurface. Implementation: `seen_at < now() - interval '90 days'` excluded from the NOT EXISTS filter.

## Requirements

**Functional:**
- Anon UX: localStorage/sessionStorage stores `seenIds: string[]` with cap 50; sent in body on every recommend call.
- Signed-in: `user_seen_job` rows added by Phase 04; refresh excludes them.
- 90-day sliding TTL: NOT EXISTS predicate becomes `WHERE seen_at > now() - interval '90 days'`.
- Empty-after-dedup detection: when zero jobs returned AND there exist pool jobs that ARE seen → surface "No more new matches" UI.
- Admin reset endpoint: `POST /api/admin/seen/reset` for self (operator) or `?userId=X` for support.

**Non-functional:**
- No new heavyweight queries — reuse the existing topK with adjusted NOT EXISTS clause.
- Anon storage: respect browser limits (sessionStorage ~5-10 MB; 50 ids × 16 chars = 0.8 KB, safe).

## Architecture

```
Anon refresh:
  Client:
    seenIds = JSON.parse(sessionStorage.getItem('jobfit:seen') || '[]').slice(-50)
    POST /api/jobs/recommend { cvText, seenIds }
  Server:
    excludeIds = body.seenIds; (passed to topK)
    Return jobs.
  Client (after):
    seenIds = [...seenIds, ...jobs.map(j=>j.jobId)].slice(-50)
    sessionStorage.setItem('jobfit:seen', JSON.stringify(seenIds))

Signed-in refresh:
  Server:
    excludeForUserId = session.userId; (server-side NOT EXISTS user_seen_job WHERE seen_at > now()-90d)
    After response: INSERT INTO user_seen_job ON CONFLICT DO NOTHING
  Response includes: { jobs, exhaustedPool: boolean }

UI on empty + exhaustedPool:
  Show banner: "No more new matches in your vertical. Try uploading a different CV, or broaden your search."
  CTA buttons: [Upload new CV] [Reset seen jobs (signed-in only)]

Admin reset:
  POST /api/admin/seen/reset → DELETE user_seen_job WHERE user_id = $auth.userId
  POST /api/admin/seen/reset?userId=X → admin-only, deletes for X
```

## Related Code Files

**To create:**
- `cv-ex-refactor/src/lib/jobs/seen-store.ts` — extend Phase 04 helper with `clearSeenForUser(userId)`, `seenCountForUser(userId)`.
- `cv-ex-refactor/src/app/api/admin/seen/reset/route.ts` — admin reset endpoint.
- `cv-ex-refactor/src/lib/client/anon-seen.ts` — sessionStorage helpers (`getSeenIds`, `appendSeenIds`).
- `cv-ex-refactor/src/components/job-fit/exhausted-pool-banner.tsx` — UX banner.

**To modify:**
- `cv-ex-refactor/src/app/api/jobs/recommend/route.ts` — add `exhaustedPool: boolean` to response, computed from pre-gate vs post-dedup candidate counts.
- `cv-ex-refactor/src/lib/jobs/repo-postgres.ts` (Phase 02) — update NOT EXISTS to include 90d TTL window.
- `cv-ex-refactor/src/app/job-fit/page.tsx` (or relevant client component) — read `exhaustedPool`, render banner conditionally.
- `cv-ex-refactor/src/app/job-fit/refresh-client.tsx` (or equivalent) — read/write sessionStorage for anon path.

**To delete:** none.

## Implementation Steps

1. **Update repo-postgres.ts topKByEmbedding query** — change NOT EXISTS:
   ```sql
   AND NOT EXISTS (
     SELECT 1 FROM user_seen_job
     WHERE user_id = $userId
       AND job_id = jobs.id
       AND seen_at > now() - interval '90 days'
   )
   ```

2. **Compute `exhaustedPool` in recommend route:**
   ```ts
   // After topK call (pre-LLM):
   const poolForVertical = await db.select({ count: sql`COUNT(*)` })
     .from(jobsTable)
     .where(and(eq(jobsTable.active, true), eq(jobsTable.vertical, cvVertical)));
   const seenCount = signedIn ? await seenCountForUser(userId) : (body.seenIds?.length ?? 0);
   const exhaustedPool = candidates.length === 0 && seenCount >= poolForVertical;
   ```

3. **Surface `exhaustedPool` in response** even if `jobs.length > 0` (informational).

4. **Client anon helpers:**
   ```ts
   const KEY = 'jobfit:seen';
   const MAX = 50;
   export function getSeenIds(): string[] { /* JSON.parse with try/catch */ }
   export function appendSeenIds(ids: string[]): void {
     const cur = getSeenIds();
     const merged = [...cur, ...ids];
     const deduped = [...new Set(merged)].slice(-MAX);
     sessionStorage.setItem(KEY, JSON.stringify(deduped));
   }
   ```

5. **Refresh button wiring (anon):**
   - Before request: read `seenIds` and include in body.
   - After response: append returned `jobId`s.

6. **Banner component:** `exhaustedPool && jobs.length === 0` → render. Two CTA buttons.

7. **Admin reset endpoint:**
   - Auth: `getSession() && isAdminUser(session.user)` for foreign userId; `session.user.id === reset target` for self.
   - `DELETE FROM user_seen_job WHERE user_id = $1`.
   - Response: `{ deleted: number }`.

8. **Tests:**
   - 90d TTL: insert seen 91d ago + 50d ago; query → only 50d-old excluded.
   - exhaustedPool: insert 5 jobs, mark all 5 seen, refresh → exhaustedPool=true.
   - Anon storage: simulate 60 ids appended → length capped at 50.
   - Reset: insert seen rows, hit reset endpoint, query → 0 rows.

## Todo List

- [ ] Update repo-postgres.ts topK NOT EXISTS with 90d filter
- [ ] Compute exhaustedPool in recommend route
- [ ] Add exhaustedPool to response shape
- [ ] Write src/lib/client/anon-seen.ts (sessionStorage helpers)
- [ ] Wire refresh client to read/write sessionStorage (anon path)
- [ ] Write src/components/job-fit/exhausted-pool-banner.tsx
- [ ] Conditionally render banner in job-fit page
- [ ] Write /api/admin/seen/reset endpoint
- [ ] Add "Reset seen jobs" CTA in banner for signed-in
- [ ] Unit + integration tests (90d TTL, exhaustion, anon cap, reset)
- [ ] Update docs (recommend response shape, admin endpoints)

## Success Criteria

- Signed-in user refreshes 5 times → never sees the same job twice (within 90d).
- Anon user refreshes 5 times in same tab → never sees same job twice (within session).
- Anon opens new tab → sessionStorage empty → repeat candidates allowed (acceptable per design).
- When user has seen all matching jobs → banner renders with CTAs.
- Admin reset clears `user_seen_job` rows; next refresh returns previously-seen jobs.

## Risk Assessment

| # | Risk | L | I | Mit |
|---|---|---|---|---|
| 1 | 90d TTL breaks recommend if all top-K candidates are within window | L | M | Banner UX surfaces the case; user can reset or wait for ingest |
| 2 | sessionStorage disabled (private browsing edge cases) | L | L | Try/catch wrap; if fails, anon behaves as "no dedup" — acceptable |
| 3 | Reset endpoint abuse (user spams to dump pool) | L | L | Rate-limit at 1 req / 60s per user via existing quota middleware |
| 4 | exhaustedPool count query adds latency per request | M | L | Cache pool size per vertical for 60s in module memory |

## Security Considerations

- Admin reset for foreign userId requires `isAdminUser` check.
- Self reset: derive userId from session, never trust body.
- `user_seen_job` deletion is non-destructive (creates space for re-show, doesn't lose data integrity elsewhere).

## Rollback Plan

- Feature flag `JOBFIT_PERSISTENT_DEDUP=true|false`. When false: skip NOT EXISTS and INSERT — behaves like pre-Phase-04 (full pool each refresh).
- New UX banner is additive — removing the conditional render reverts the UI safely.

## Next Steps

- Phase 08 deletes legacy KV `jobs:active` set + score.ts / pack-embeddings.ts after observation window.
