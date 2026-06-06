# Phase 04 — Recommend Endpoint Rewrite (pgvector + Tier Gate)

## Context Links

- Current route: `cv-ex-refactor/src/app/api/jobs/recommend/route.ts`
- Tier semantics: `cv-ex-refactor/src/lib/jobs/fit-tier.ts`
- Repo: Phase 02 `repo-postgres.topKByEmbedding`
- Auth: existing NextAuth — `cv-ex-refactor/src/lib/get-session.ts`

## Overview

- Priority: P1
- Status: pending
- Effort: 6-8h
- Blocks: 07
- Blocked by: 02

Rewrite the recommend route to (1) query pgvector for top-K candidates, (2) gate output by user tier (anon / free / paid), (3) record seen jobs for signed-in users, (4) keep KV-resident pieces (embed-cache, quota, kill-switch) untouched.

## Key Insights

- Drop in-memory cosine loop (`topKCandidates` over module-scope memo) → SQL `ORDER BY embedding <=> $1`.
- Drop vertical-index sidecar lookup → SQL `WHERE vertical = $1` (HNSW + b-tree composite plan).
- Tier-gating happens AFTER the LLM scoring + `enforceQuota`, NOT before (LLM still scores all 6 candidates; we filter the final list by allowed tiers).
- `seen` write happens AT RESPONSE TIME for signed-in users: `INSERT INTO user_seen_job (user_id, job_id) ... ON CONFLICT DO NOTHING` for every job in the returned list.
- Anon users: route returns the same recommend response but client-side stores `jobId` in sessionStorage; next call sends `seenIds: string[]` in body (capped at 50).
- Admin pilot-lockdown gate at top of route → REMOVE (replaced by free-tier serving 1-2 jobs to all signed-in users).

## Requirements

**Functional:**
- Tier resolution per request:
  - No session → `anon`
  - Session + no active subscription → `free`
  - Session + `subscriptions.status='active' AND current_period_end > now()` → `paid`
- Output cap by tier (post-quota):
  - anon → 1 job, tier B only (default — see plan.md Q1)
  - free → up to 2 jobs, tier B only
  - paid → up to 10 jobs (existing QUOTA — S:1 A:3 B:2 C:2 D:1 E:1)
- candidate K from pgvector:
  - paid → K=12 (extra for LLM headroom + tier mix)
  - free / anon → K=6 (one tier-B + ranking headroom)
- Persist seen for signed-in: `INSERT INTO user_seen_job ON CONFLICT DO NOTHING` for each returned `jobId`.
- For anon: accept `seenIds?: string[]` in request body; pass as `excludeIds` to `topKByEmbedding`.

**Non-functional:**
- p95 ≤25s (no regression).
- DB query slice ≤300ms p95.
- No KV reads removed for embed-cache or quota — those calls stay byte-for-byte.

## Architecture

```
POST /api/jobs/recommend
  ↓
1. parse body + zod
2. session = getSession()
3. tier = resolveUserTier(session)   ← new helper, reads subscriptions table
4. apiKey resolution (unchanged: BYOK / shared / quota)
5. kill-switch check (unchanged, KV)
6. embed CV (embed-cache lookup KV → embedText fallback)  ← unchanged
7. classifyCvVertical (regex, in-process)                 ← unchanged
8. K = tier === 'paid' ? 12 : 6
9. candidates = repo.topKByEmbedding(cvEmb, { vertical, k: K,
       excludeForUserId: signedIn ? session.userId : undefined,
       excludeIds: anon ? body.seenIds : undefined })
10. jobs = repo.getJobBatch(candidates.map(c=>c.id))
11. LLM call (unchanged contract; same prompts + retry + parser)
12. matchedJobs = normalizeRecommend(...)
13. tier-gate filter:
     - paid → existing enforceQuota result, capped at 10
     - free → filter to tier='B', cap at 2
     - anon → filter to tier='B', cap at 1
14. for each j in matchedJobs (signed-in only):
       INSERT INTO user_seen_job (user_id, job_id) ON CONFLICT DO NOTHING
15. return { jobs, fromCache, pool, tier, seenPolicy: signed?'persisted':'client' }
```

## Related Code Files

**To create:**
- `cv-ex-refactor/src/lib/users/resolve-tier.ts` — `resolveUserTier(session): 'anon'|'free'|'paid'` querying subscriptions table.
- `cv-ex-refactor/src/lib/jobs/seen-store.ts` — `markSeenForUser(userId, jobIds)`, `seenIdsForUser(userId, sinceDays)`.
- `cv-ex-refactor/src/lib/jobs/tier-gate.ts` — `applyTierGate(matches: JobMatch[], tier): JobMatch[]`.

**To modify:**
- `cv-ex-refactor/src/app/api/jobs/recommend/route.ts` — wire the new helpers, drop admin lockdown, add `export const preferredRegion = 'sin1'`.
- `cv-ex-refactor/src/lib/schemas/job-recommend-request.ts` — add `seenIds?: string[]` (optional, max 50, only used for anon).
- `cv-ex-refactor/src/lib/jobs/classify-cv-vertical.ts` — no change (still in-process regex).

**To delete (deferred to Phase 8):**
- `cv-ex-refactor/src/lib/jobs/score.ts`
- `cv-ex-refactor/src/lib/jobs/pack-embeddings.ts`
- `cv-ex-refactor/src/lib/jobs/vertical-index.ts`

## Implementation Steps

1. **Write `resolve-tier.ts`:**
   ```ts
   export async function resolveUserTier(session: Session|null): Promise<'anon'|'free'|'paid'> {
     if (!session?.user?.id) return 'anon';
     const row = await db.select().from(subscriptions)
       .where(and(eq(subscriptions.userId, session.user.id),
                  eq(subscriptions.status, 'active'),
                  gt(subscriptions.currentPeriodEnd, new Date())))
       .limit(1);
     return row.length > 0 ? 'paid' : 'free';
   }
   ```

2. **Write `tier-gate.ts`:** allowed tiers per role:
   ```ts
   const ALLOWED: Record<UserTier, Set<TierLetter>> = {
     anon: new Set(['B']),
     free: new Set(['B']),
     paid: new Set(['S','A','B','C','D','E']),
   };
   const CAP: Record<UserTier, number> = { anon: 1, free: 2, paid: 10 };
   export function applyTierGate(matches, tier) {
     return matches.filter(m => ALLOWED[tier].has(m.tier)).slice(0, CAP[tier]);
   }
   ```

3. **Write `seen-store.ts`:**
   ```ts
   export async function markSeenForUser(userId: string, jobIds: string[]) {
     if (jobIds.length === 0) return;
     await db.insert(userSeenJob)
       .values(jobIds.map(id => ({ userId, jobId: id })))
       .onConflictDoNothing();
   }
   ```

4. **Modify recommend route:**
   - Remove `if (!isAdminUser(...)) return 404` block.
   - Add `const session = await getSession()`.
   - Add `const tier = await resolveUserTier(session)`.
   - Use `tier === 'paid' ? 12 : 6` for K.
   - Replace `topKCandidates(cvEmbedding, 6, allowedIds)` with `repo.topKByEmbedding(cvEmbedding, { vertical, k, excludeForUserId, excludeIds })`.
   - Remove the `getJobIdsForVertical` call + sidecar lookup — pg query handles it.
   - After `normalizeRecommend`, call `applyTierGate(matchedJobs, tier)`.
   - After applying gate, if signed-in: `await markSeenForUser(session.user.id, gated.map(j=>j.jobId))`.
   - Add `tier` + `seenPolicy` to response body.

5. **Update request schema:**
   ```ts
   seenIds: z.array(z.string().max(32)).max(50).optional(),
   ```

6. **Adjust K → LLM token budget**: K=12 may risk MAX_TOKENS in LLM. Mitigate: when tier='paid', use trimmed prompt variant that asks for tier S/A/B only first; if those fill quota, skip C/D/E. Defer micro-optimization unless we see MAX_TOKENS in logs.

7. **Tests** in `src/app/api/jobs/recommend/__tests__/route.test.ts`:
   - Anon request → max 1 job, tier='B'.
   - Free user mock → max 2 jobs, all tier='B'.
   - Paid user mock → up to 10, mix of tiers.
   - Signed-in second call → `user_seen_job` excludes previously returned ids.
   - Anon with `seenIds` body → excludes those ids.

## Todo List

- [ ] Write src/lib/users/resolve-tier.ts + unit test
- [ ] Write src/lib/jobs/tier-gate.ts + unit test
- [ ] Write src/lib/jobs/seen-store.ts + unit test (mock db)
- [ ] Update recommend request schema with seenIds
- [ ] Modify recommend route: remove admin gate, add tier resolution, swap to pgvector, add seen persistence
- [ ] Add export const preferredRegion = 'sin1' at route top
- [ ] Integration test all 3 tiers + dedup
- [ ] Update docs/system-architecture.md (recommend pipeline section)
- [ ] Verify p95 latency in Vercel logs (matches pre-cutover)

## Success Criteria

- 3-tier matrix test passes (anon/free/paid return correct shape).
- Signed-in user: second call returns 0 overlap with first call.
- `EXPLAIN ANALYZE` of topK query shows HNSW index hit; p95 ≤300ms.
- Recommend p95 end-to-end ≤25s on prod for 20-request sample.
- KV embed-cache hit rate ≥40% in first day post-deploy (validates cache still works).

## Risk Assessment

| # | Risk | L | I | Mit |
|---|---|---|---|---|
| 1 | Free tier returns 0 jobs (no tier-B in top-6 candidates) | M | H | If gated list empty, do a SECOND pgvector query with broader K=12 + LLM-rescore tier B candidates only. Fail-message if still 0. |
| 2 | LLM MAX_TOKENS at K=12 for paid | M | M | Monitor finishReason; tighten prompt or reduce per-job description chars |
| 3 | seen-write race: user double-clicks Refresh → same jobs marked seen twice | L | L | ON CONFLICT DO NOTHING is idempotent |
| 4 | resolveUserTier adds 50-100ms on every request | M | L | Cache per-userId in-memory 60s; flush on subscription webhook |
| 5 | Admin lockdown removal exposes endpoint before /upgrade UI exists | M | M | Phase 06 (monetization UI) lands BEFORE Phase 04 ships to prod; or land Phase 04 behind feature flag `JOBFIT_PUBLIC_ENABLED` |

## Security Considerations

- `excludeForUserId` always derived from server-side session, never trust body.
- `seenIds` from anon body capped at 50 strings × 32 chars = 1.6KB max payload.
- Tier resolution happens server-side; client cannot self-elevate.

## Rollback Plan

- Feature flag `JOBFIT_USE_POSTGRES=true|false` (env var). When false: route reads KV via legacy code path (kept until Phase 8).
- If pgvector behaves badly post-deploy, flip flag → recommend reverts to KV reads instantly.
- DB writes (`user_seen_job`) are additive; rollback leaves orphan rows that next deploy reuses.

## Next Steps

- Phase 06 builds the /upgrade UI + SePay so paid tier has a path to convert.
- Phase 07 adds "no more new matches" UX when user exhausts their pool.
- Phase 08 deletes legacy KV code paths.
