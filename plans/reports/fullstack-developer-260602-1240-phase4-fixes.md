# Phase 4 — P1/P2 Security Fixes

**Date:** 2026-06-02
**Agent:** fullstack-developer
**Source review:** `plans/reports/code-review-260602-1240-phase4-backend.md`

---

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/r/[jobId]/route.ts` | +14 lines: scheme allowlist before redirect |
| `src/app/api/jobs/refresh/route.ts` | +12 lines: timingSafeEqual, deadline guard, sequential expire, autoExpiredIds set |
| `src/lib/usage/read-job-fit-stats.ts` | -8 / +19 lines: scanAll helper, import weekMondayYmd, drop local duplicate |
| `src/app/api/topics/feedback/route.ts` | -8 / +3 lines: import weekMondayYmd, drop local weekYmd() |
| `src/lib/jobs/refresh-batch.ts` | +9 lines: defense-in-depth scheme check before headWithFallback |
| `src/lib/usage/week-monday-ymd.ts` | NEW — 11 lines: shared weekMondayYmd() |

---

## Per-Finding: Before / After

### P1.1 — Open-redirect XSS (`r/[jobId]/route.ts`)
- **Before:** `NextResponse.redirect(job.sourceUrl, { status: 302 })` — no scheme check
- **After:** `new URL(job.sourceUrl)` parse + `protocol !== 'https:' && !== 'http:'` guard → 502 on invalid scheme; logs jobId + protocol (no secret). `target.toString()` passed to redirect.
- **Also:** `refresh-batch.ts` — same guard before `headWithFallback`; skips id with `errors++` and `continue` on non-http(s) scheme.

### P1.2 — Auto-expire sweep unbounded (`refresh/route.ts` lines 83-97)
- **Before:** `for (const id of activeIds)` loop — no deadline check inside
- **After:** `if (Date.now() >= deadlineMs) break;` as first statement inside loop

### P1.3 — Stats hash TTL race (`refresh/route.ts` lines 119-126)
- **Before:** `Promise.allSettled([hincrby×4, expire])` — expire fires in parallel with writes
- **After:** `await Promise.all([hincrby×4])` then `await kv.expire(statsKey, 86400 * 2)` — expire guaranteed to run after key exists

### P1.4 — kv.scan single-shot truncation (`read-job-fit-stats.ts`)
- **Before:** `const [, clickKeys] = await kv.scan(0, { count: 50 })` — one page only
- **After:** `scanAll(pattern)` do-while cursor loop until `String(cursor) === '0'`, `count: 100`; used for both click keys and dislike keys

### P2.1 — Non-constant-time CRON_SECRET compare (`refresh/route.ts` lines 54-62)
- **Before:** `authHeader !== \`Bearer ${cronSecret}\`` — short-circuit string compare
- **After:** `import { timingSafeEqual } from 'node:crypto'`; length check + `timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))`

### P2.2 — weekMondayYmd duplicated (`topics/feedback/route.ts` + `read-job-fit-stats.ts`)
- **Before:** `weekYmd()` defined locally in feedback route; `weekMondayYmd()` defined locally in stats reader — two copies, can drift
- **After:** `src/lib/usage/week-monday-ymd.ts` — single export `weekMondayYmd(date = new Date()): string`; both files import from it

### P2.7 (bonus, in scope per review §Recommended actions item 7) — expired double-count
- **Before:** `batchIds = activeIds.slice(cursor)` — includes IDs already auto-expired
- **After:** `autoExpiredIds = new Set<string>()`; populated during sweep; `batchIds = activeIds.slice(cursor).filter(id => !autoExpiredIds.has(id))`

---

## Build Result

```
✓ Compiled successfully in 10.8s
✓ TypeScript clean (5.8s)
✓ 25/25 pages generated
All routes (including /api/r/[jobId], /api/jobs/refresh, /api/topics/feedback) appear as ƒ (Dynamic)
```

## Test Result

```
Test Files  6 passed (6)
Tests       28 passed (28)
Duration    617ms
```

28/28 — all pass.

## Smoke Re-runs

| Case | Expected | Actual |
|------|----------|--------|
| `GET /api/jobs/refresh` with `Authorization: Bearer wrong` | 401 | 401 ✓ |
| `GET /api/r/abcdef0123456789` (KV not configured) | 503 | 503 ✓ |

P1.1 scheme-rejection code path not directly smoke-able without KV; the logic is: `new URL(sourceUrl)` throws → 502, or `protocol !== 'https:' && !== 'http:'` → 502. Covered by code inspection — identical pattern to `src/lib/scrape/validate-url.ts` in existing codebase.

P1.3 sequential expire: confirmed by code inspection — `await Promise.all([hincrby×4])` then `await kv.expire(...)` on separate lines.

## Deviations from Spec

- Task spec suggested `week-monday-ymd.ts` path for P2.2; review report suggested `lib/quota/iso-week.ts`. Used task spec path (`lib/usage/week-monday-ymd.ts`) — more semantically consistent with the two consuming files both being in usage layer.
- `JobInput.sourceUrl` zod schema tightening (mentioned as belt-and-braces in P1.1): `lib/jobs/types.ts` uses plain TypeScript interfaces, not zod. No schema exists at ingest boundary. Added comment flag in `refresh-batch.ts`. Deferred to Phase 5 per review's own recommendation ("flag if no schema exists — defer to Phase 5").
- P2.7 (double-count) shipped alongside P1.2 since the `autoExpiredIds` set was a natural output of the deadline-guarded loop and was explicitly in the review's recommended actions list.

---

**Status:** DONE
**Summary:** All 4 P1 + 2 P2 findings fixed. Build clean, 28/28 tests pass, dev server running. Not committed per instructions.
**Concerns:** None blocking. `kv.scan` return type cast (`page[0] as string | number`) is pragmatic — Upstash SDK typing is loose here; the do-while termination condition `String(cursor) !== '0'` is safe regardless of whether cursor comes back as `0` (number) or `"0"` (string).
