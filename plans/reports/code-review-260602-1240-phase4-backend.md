# Phase 4 backend — adversarial code review

**Date:** 2026-06-02
**Scope (uncommitted vs HEAD `e16e802`):**
- NEW: `cv-ex-refactor/src/lib/schemas/topic-feedback-request.ts`, `src/lib/jobs/refresh-batch.ts`, `src/app/api/jobs/refresh/route.ts`, `src/app/api/r/[jobId]/route.ts`, `src/app/api/topics/feedback/route.ts`, `vercel.ts`, `src/lib/usage/read-job-fit-stats.ts`, `src/app/(app)/admin/usage/job-fit-stats-section.tsx`
- MOD: `src/lib/jobs/repo.ts` (+touchVerifiedAt), `src/lib/env.ts` (+CRON_SECRET), `src/app/(app)/admin/usage/page.tsx` (glue → 248 LOC), `.env.example`, `docs/deployment.md`

**Build:** `pnpm next build` ok. `tsc --noEmit` clean.

---

## P1 — blocking before commit

### P1.1 — Open-redirect vector via `javascript:` (and other dangerous) URL schemes in KV
`src/app/api/r/[jobId]/route.ts:53` calls `NextResponse.redirect(job.sourceUrl, ...)` with no scheme allowlist. Verified empirically:
```
node -e "import('next/server.js').then(({NextResponse}) => {
  const r = NextResponse.redirect('javascript:alert(1)', { status: 302 });
  console.log(r.headers.get('location'));   // → javascript:alert(1)
});
```
Next does NOT strip `javascript:`. Modern browsers won't follow a `javascript:` `Location:` header, but `data:` URIs and other non-`http(s)` schemes still pose phishing/exfil risk, and defense-in-depth at the boundary is cheap.

**Attack path:** `scripts/ingest-file.ts:61` only checks `if (!entry.sourceUrl)` — no scheme validation. A maliciously crafted seed JSON (or operator mistake) makes `job.sourceUrl = "data:text/html,<script>..."` → redirect endpoint serves it. Since this route also writes a click metric per job, the attacker can also gain free metrics writes.

**Fix (minimal, redirect route only — closes the boundary):**
```ts
// in /api/r/[jobId]/route.ts before NextResponse.redirect
let target: URL;
try { target = new URL(job.sourceUrl); } catch { return errJson('invalid_target','Invalid stored URL.',502); }
if (target.protocol !== 'https:' && target.protocol !== 'http:') {
  return errJson('invalid_target','Refusing non-http(s) redirect.',502);
}
return NextResponse.redirect(target.toString(), { status: 302, headers: { 'Cache-Control': 'no-store' } });
```
Belt + braces: also tighten `JobInput` to `sourceUrl: z.string().url().refine(u => /^https?:/.test(u))` at ingest time — but the route-level check is the must-have because it covers existing KV data.

### P1.2 — `Date.now() < opts.deadlineMs` guard around sleep ignores in-flight time
`src/lib/jobs/refresh-batch.ts:127-130`:
```ts
if (i < ids.length - 1 && Date.now() < opts.deadlineMs) {
  ...
  await sleep(opts.sleepMs + jitter);
}
```
At the top of the next iteration the deadline guard at line 88 will break — so this is functionally ok. **Not a P1.** Demoting; see P3.5.

### P1.3 — Refresh sweep auto-expires on first read after deploy
`src/app/api/jobs/refresh/route.ts:73-86` does a **synchronous** sweep over **every active job** comparing `now - verifiedAt > 21d`, **before** the HEAD-batch loop. Two problems:

1. **Unbounded latency:** at 150 jobs × ~50ms KV hgetall round-trip = ~7.5s wasted before any HEAD goes out. Each new ingest pushes it further. With Pro 300s budget OK today, but it eats into the deadline buffer and is not deadline-guarded (no `Date.now() < deadlineMs` check inside the for-loop).
2. **First-tick mass expiration risk:** when first cron tick runs N days after a backfill where all 150 seed jobs share the same `verifiedAt`, if any were ingested >21d ago the pool collapses in one tick.

**Fix:** Add the same deadline guard inside the sweep loop, and prefer a ZSET-by-verifiedAt for O(log N) lookup. For v0.3 single tick at 150 jobs the deadline guard alone is sufficient:
```ts
for (const id of activeIds) {
  if (Date.now() >= deadlineMs) break;
  ...
}
```

### P1.4 — Stats hash key has no TTL on first write (race in `Promise.allSettled`)
`refresh/route.ts:108-114`:
```ts
await Promise.allSettled([
  kv.hincrby(statsKey, 'ok', ok),
  kv.hincrby(statsKey, 'expired', ...),
  kv.hincrby(statsKey, 'errors', errors),
  kv.hincrby(statsKey, 'batches', 1),
  kv.expire(statsKey, 86400 * 2),   // ← can run BEFORE the hincrby creates the key
]);
```
`Promise.allSettled` does not order the calls. Upstash is REST → all 5 fire in parallel. If `kv.expire` arrives before the first `kv.hincrby` creates the key, EXPIRE returns 0 (key doesn't exist) and the key gets **no TTL**, which leaks daily metrics keys forever. Low frequency (1 cron/day) but it does leak.

**Fix:** chain expire after hincrby completes, or use SET EX semantics:
```ts
await Promise.all([
  kv.hincrby(statsKey, 'ok', ok),
  kv.hincrby(statsKey, 'expired', expired + autoExpired),
  kv.hincrby(statsKey, 'errors', errors),
  kv.hincrby(statsKey, 'batches', 1),
]);
await kv.expire(statsKey, 86400 * 2);
```

### P1.5 — `admin/usage` is server-rendered; failed `getJobFitStats` blocks the entire page
`page.tsx:54` `await getJobFitStats(...)`. `read-job-fit-stats.ts` catches all errors and returns `EMPTY` — good. BUT line 74 + 97 use `kv.scan(0, ...)` which is a **single-shot scan**. Upstash `SCAN` returns at most ~`count` keys per call. With `count: 50`, anything beyond 50 click keys or 50 dislike keys is silently truncated.

For 150 jobs × clicks today this is fine, but the comment "Upstash scan returns [nextCursor, keys]. count=50 is a hint, not a hard limit." is misleading — it IS effectively capped per call and the code **never iterates the cursor**. Top-10 over a partial set will produce wrong/missing rankings when the dataset grows.

**Fix:** loop until cursor=0:
```ts
async function scanAll(pattern: string): Promise<string[]> {
  const out: string[] = [];
  let cursor = 0;
  do {
    const [next, batch] = await kv.scan(cursor, { match: pattern, count: 200 });
    out.push(...batch);
    cursor = Number(next);
  } while (cursor !== 0);
  return out;
}
```

---

## P2 — should fix this PR

### P2.1 — `CRON_SECRET` comparison is non-constant-time
`refresh/route.ts:53` `authHeader !== \`Bearer ${cronSecret}\``. Vercel injects the same secret per request; an attacker probing the route can use response timing to deduce prefix bytes (Node string compare short-circuits on first mismatch). For a hex secret of 24 bytes the realistic timing signal in production is small but not zero.

**Fix:** use `crypto.timingSafeEqual` over buffers of equal length:
```ts
import { timingSafeEqual } from 'node:crypto';
const expected = `Bearer ${cronSecret}`;
const a = Buffer.from(authHeader);
const b = Buffer.from(expected);
if (a.length !== b.length || !timingSafeEqual(a, b)) return errJson('unauthorized', ...);
```

### P2.2 — Click metric writes block the redirect (`await Promise.allSettled`)
`r/[jobId]/route.ts:47-51` says "fire-and-forget" in the comment but the code awaits. Adds 50-200ms per redirect under Upstash REST latency. Either:
- Document the contract honestly (it's blocking),
- Or use `void` and a setTimeout(0) to detach. Vercel functions DO complete after `return` so background work is unreliable on serverless — recommendation: keep the await but drop the misleading comment.

### P2.3 — `kv.scan(0, ...)` typed as `[string, string[]]` but Upstash returns `[number|string, string[]]`
`read-job-fit-stats.ts:74,97`. The cast is fine for Upstash REST (returns numeric cursor), but the cast obscures the missing iteration (P1.5). Drop the cast once P1.5 is implemented.

### P2.4 — `weekMondayYmd()` duplicated across `topics/feedback/route.ts` (`weekYmd`) and `read-job-fit-stats.ts`
Both compute "Monday of current UTC week", but the writer is in the feedback route and the reader is in the stats file. If anyone tweaks one and not the other the key shape diverges → top-disliked-topics breaks silently.

**Fix:** extract to `src/lib/quota/iso-week.ts` and import from both. DRY.

Also subtle: when run on a **Monday at 00:00 UTC**, both functions return today (correct). On a Sunday 23:59 UTC both return last Monday. Behaviour matches, just keep one source.

### P2.5 — `admin/usage/page.tsx` now 248 LOC (limit 200)
Lead acknowledged. Extract `Stat`, `Th`, `Td`, `UserRow` to a co-located `_components.tsx` brings page.tsx back under 200. Not a release blocker, but the development rule is explicit.

### P2.6 — `read-job-fit-stats.ts` filters total-clicks key by string equality
Line 79-81: `clickKeys.filter((k) => k !== \`metrics:click:total:${ymd}\`)`. Correct, but the per-job key slicing on line 88 is brittle: `k.slice('metrics:click:'.length).slice(0, -ymd.length - 1)`. If a future jobId contains a colon (it can't with `[a-f0-9]{16}` today, but the slice assumes that invariant forever), this silently mangles the id. Suggest using a regex `^metrics:click:([a-f0-9]{16}):` to make the invariant explicit.

### P2.7 — Refresh stat `expired` is double-counted into `autoExpired`
`refresh/route.ts:117` `const remainingActive = activeIds.length - expired - autoExpired;`
`activeIds` was snapshotted at line 69 BEFORE the auto-expire sweep mutated `jobs:active`. So `activeIds.length` overstates by `autoExpired`. The subtraction is correct.
BUT: a HEAD-result `expired` could overlap with `autoExpired` if a job was already auto-expired this tick and then the batch loop visited it via the snapshot — `expireJob` (smove) is idempotent so no error, but the count gets inflated. At 150 jobs with one daily tick the inflation is bounded but noisy.

**Fix:** filter the batch by jobs not already auto-expired:
```ts
const autoExpiredIds = new Set<string>();
// during sweep: autoExpiredIds.add(id)
const batchIds = activeIds.slice(cursor).filter(id => !autoExpiredIds.has(id));
```

---

## P3 — nits, defer if not trivial

### P3.1 — `ids[i] as string` cast in `refresh-batch.ts:90`
Probably `noUncheckedIndexedAccess: true` in tsconfig. Since the loop bound is `i < ids.length`, the access is safe. Cast is fine; alternative is `const id = ids[i]; if (!id) continue;` — more verbose, same outcome. Skip.

### P3.2 — `headWithFallback` clears tid then sets tid2 — fine
The 405 retry path correctly clears the first timeout and arms a fresh one. No leak.

### P3.3 — `firePoolLowAlert` swallows fetch errors silently
`refresh/route.ts:43-45` — silent catch is appropriate (don't block cron on Slack webhook failure), but a `console.warn` would help diagnose missing alerts. One-line add.

### P3.4 — `vercel.ts` uses `@vercel/config` devDep
Build picked it up (verified by `pnpm next build` succeeding). Vercel CLI doc says either `vercel.json` or `vercel.ts` works; on the dashboard side this gets picked up at deploy. **Watch for:** at deploy time, Vercel may not run `tsc` on `vercel.ts` if the project is not a `next-on-vercel` install with the TS config flag — recommend smoke-testing by deploying to a preview first. Not blocking.

### P3.5 — `Date.now() < opts.deadlineMs` re-check before sleep
`refresh-batch.ts:127`. Redundant with the top-of-loop check at line 88, but harmless. Skip.

### P3.6 — `auto-expired` jobs are not re-embedded out of the embedding ZSET
v0.3 has no embedding index pruning. Expired jobs stay in `embeddings:active:*` until next blob rebuild. `topKCandidates` will still surface them — but `getJobBatch` returns nothing for expired ids (they're in `jobs:expired`, not `jobs:active`), so they get filtered downstream. Verify in Phase 2's score path. Out of scope for Phase 4 but worth a follow-up ticket.

### P3.7 — `.env.example` says CRON_SECRET is "for local smoke tests only"
That's accurate but slightly misleading: in production Vercel **auto-injects** the secret, but operator MUST set it in the Vercel Project Settings or cron auth fails — the auto-inject is the Authorization header, not the env var itself. Confirm reading of `docs/deployment.md` §12 — it does cover this. Suggest a one-line clarification in `.env.example`.

### P3.8 — No rate-limit on `/api/topics/feedback`
Plan mentioned reusing existing IP rate-limit lib. Not implemented. At zero auth + unbounded `lpush`, a hostile client can flood the dislike list. Bounded `ltrim(0, 999)` caps memory, but writes still hit Upstash. Defer to v0.3b — note in changelog.

### P3.9 — No `robots.txt` honor in `refresh-batch.ts`
Plan risk matrix flagged it. Deferred. ItViec/TopCV bot-detection may bite. Worth a stub `getRobotsAllow(host)` helper later.

### P3.10 — `vercel.ts` cron schedule comment matches reality
`0 20 * * *` = 20:00 UTC = 03:00 ICT (UTC+7). ✓

### P3.11 — `read-usage.ts` got a trailing newline-only change
Diff shows just a blank line appended. Cosmetic.

---

## Smoke claim verification (re-run)

Started `pnpm next dev` with KV unset, no `CRON_SECRET`. Results:

| Case | Expected | Actual | ✓ |
|---|---|---|---|
| `GET /api/r/AAAA1111BBBB2222` (uppercase) | 400 invalid_job_id | `400` | ✓ |
| `GET /api/r/abc` (short) | 400 invalid_job_id | `400` | ✓ |
| `GET /api/r/abcdef0123456789` (KV down) | 503 service_unavailable | `{"ok":false,"error":{"code":"service_unavailable","message":"KV not configured."}}` | ✓ |
| `POST /api/topics/feedback` with extra `reason` key | 400 invalid_input | `{"code":"invalid_input","message":"Unrecognized key: \"reason\""}` | ✓ |
| `POST /api/topics/feedback` valid body, KV down | 204 (skip writes) | `204` | ✓ |
| `GET /api/jobs/refresh` no auth | 401 unauthorized | `{"code":"unauthorized","message":"Invalid or missing Authorization header."}` | ✓ |
| `GET /api/jobs/refresh` `Authorization: Bearer wrong` | 401 (CRON_SECRET unset → reject) | `401` | ✓ |

Last row is important: when `CRON_SECRET` env is **unset**, code correctly rejects ALL bearers (`!cronSecret` short-circuit). No "any bearer accepted" backdoor. ✓

UI client `api-client.ts:47` posts `{ jobId, topicId: topicName, action: 'dislike' }` — field-name/shape matches the strict zod schema exactly. ✓

---

## Cost-guard audit (recommend route)
Re-read `src/app/api/jobs/recommend/route.ts`:
- `checkKillSwitch('job-recommend')` at line 45, **before** any embedding or LLM call. ✓
- `recordCost` at line 140, **after** successful LLM call. ✓
- Error paths at lines 108-116, 119-127, 132-138 return without recording cost. ✓ (Intentional: failed call still consumed tokens at provider, but partial-cost recording adds complexity; current pessimistic-budget behavior is acceptable.)

---

## Other observations
- No secrets logged in any route. ✓
- `Cache-Control: no-store` on redirect. ✓
- Feedback `lpush` + `ltrim` is correctly bounded. `expire` on dislike counter set with `60 * 24 * 60 * 60` = 5184000 seconds = 60 days. Upstash `EXPIRE` takes seconds. ✓
- `runtime = 'nodejs'` on all three routes — correct for Upstash REST. ✓
- `getJob(id)` returns `Job | null`; refresh-batch handles `null` at line 95-97 — but increments `errors`, which conflates "vanished from KV" with "network timeout". Minor signal noise; skip.

---

## Recommended actions (ordered)
1. **P1.1** — add scheme allowlist in `r/[jobId]/route.ts` before the redirect (5 lines)
2. **P1.3** — add `if (Date.now() >= deadlineMs) break;` inside the auto-expire sweep (1 line)
3. **P1.4** — chain `kv.expire` after the parallel `hincrby` block (2-line restructure)
4. **P1.5** — implement `scanAll(pattern)` loop in `read-job-fit-stats.ts` (replace 2 single-shot scans)
5. **P2.1** — `timingSafeEqual` for `CRON_SECRET` comparison (4 lines)
6. **P2.4** — extract `weekMondayYmd` to `lib/quota/iso-week.ts`, import in 2 places
7. **P2.7** — exclude auto-expired ids from the batch loop (5-line set diff)
8. **P2.5** — split `Stat`/`Th`/`Td`/`UserRow` out of `page.tsx` to get back under 200 LOC

P3 items can ride a follow-up or stay deferred.

---

## Unresolved questions
1. Should ingest-side `sourceUrl` validation be added in this PR, or deferred to Phase 5 (seed loader hardening)? Recommend route-level allowlist now + ingest validation in P5.
2. Is the 21-day `VERIFIED_AT_MAX_AGE_MS` a hard SLA, or did it come from the plan's "freshness" risk row? If hard, P1.3 must ship; if soft, it can wait.
3. Feedback endpoint has no rate-limit. Public + unauthenticated. Acceptable for v0.3 launch?

---

## Metrics
- Type coverage: tsc clean (`npx tsc --noEmit` exit 0)
- Build: `pnpm next build` ok, both new routes appear as `ƒ` (server functions)
- Lint: not run separately — defer to pre-commit hook
- LOC overage: 1 file (page.tsx at 248)

---

**Status:** APPROVE_WITH_FIXES
**Summary:** Solid Phase 4 scaffold; smoke passes; cost guard correctly ordered. Five P1 items must land before commit (open-redirect, sweep deadline, stats TTL race, scan cursor truncation — all small fixes). P2.1 timingSafeEqual is the only auth-hardening that warrants this PR.
**Concerns/Blockers:** P1.1 open-redirect is the highest-impact issue — KV poisoning via ingest leads directly to redirect-as-XSS surface. Fix at the route boundary is non-negotiable.
