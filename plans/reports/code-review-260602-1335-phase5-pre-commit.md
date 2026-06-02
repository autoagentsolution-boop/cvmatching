# Code Review — v0.3 Phase 5 Pre-Commit (Adversarial)

**Reviewer:** code-reviewer agent
**Scope:** uncommitted Phase 5 changes vs `HEAD aaf7470` — tests, smoke scripts, docs
**Reviewed:** 2026-06-02

---

## Verdict: APPROVE_WITH_FIXES

Tests are real, scripts safe, code under tests has no exposed bugs. **3 doc-drift items must be fixed before commit** (TTL mismatches that would mislead operators during incident response). Code itself is clean.

---

## P1 Findings

### 1. Vietnamese regex — NOT A BUG (false alarm)

- Direct Node.js verification: `/(job|tin tuy[eê]n d[uụ]ng|v[iị] tr[iý]).{0,80}(h[eê]t h[aạ]n|[dđ][aã]\s*[dđ][oó]ng|expired|closed)/i` matches `'vị trí Senior Engineer này đã hết hạn'` AND `'tin tuyển dụng đã đóng'` AND `'job expired'`. All return `true`.
- Test agent's claim of "didn't match in Node.js test env" was wrong diagnosis. Real reason their unicode body string failed was likely `new Response(body)` encoding round-trip in vitest — the regex itself is fine.
- **Production cron will correctly catch Vietnamese expired bodies.** No code change needed.

### 2. Stub-replacement audit — `topics-feedback-schema.test.ts` was NOT a stub

- Original HEAD version: 41 LOC with **real assertions** for inline duplicate schema (accepts valid payload / rejects `reason` field). Forward-looking placeholder, but functional.
- New version: keeps inline tests + adds 10 real schema tests against `TopicFeedbackRequestSchema` (16-hex jobId validation, strict mode, action enum). Net +60 LOC of real coverage.
- **Test report's framing as "stub→real" is misleading but harmless** — it ADDED tests, didn't replace fake ones.
- Other test files spot-checked (`classify-vertical`, `classify-seniority`, `schemas-recommend-body`, `refresh-batch`): all real assertions with explicit expected values. Zero `expect(true).toBe(true)` or always-true assertions.

### 3. Integration test `skipIf` correctness — OK

- `describe.skipIf(!hasEnv)` is evaluated by vitest at suite-collection time (after env load). Standard vitest pattern.
- `hasEnv` is computed at module top-level — when env not set in CI, skips cleanly. No premature skip risk.
- Lazy import inside `it` (`await import('@/app/api/...')`) prevents module-level KV init when skipped. Good pattern.

**Minor gap (P2):**
- `redirect-endpoint.test.ts` has `afterAll` cleanup — proper isolation.
- `feedback-endpoint.test.ts` has **NO cleanup** — writes to `topic-feedback:react-hooks` list + `dislikes:react-hooks:<weekYMD>` counter persist after test run. On shared/preview KV this leaks every run. Not security-critical (no PII), but cosmetic dirtiness. Recommend: add `afterAll` to `kv.del('topic-feedback:react-hooks')` and `kv.del('dislikes:react-hooks:<weekYMD>')`.
- `recommend-endpoint-smoke.test.ts` — no KV cleanup BUT only writes are embed-cache (HMAC keyed by CV text, auto-TTL 6h) and metrics (auto-TTL). Acceptable.

### 4. Fake passes / silent skips — CLEAN

- Grep for `.skip(`, `.todo`, `xit`, `xdescribe`: NONE.
- Grep for `expect(true)`, `expect(1).toBe(1)`: NONE.
- `toBeDefined()` only in `pack-embeddings.test.ts` (with custom failure messages, inside narrowing context) and `schemas-recommend-body.test.ts:56` (post-successful-parse, asserting default applied). Both legitimate.
- Smoke script step 3 — `SKIP: no jobId` is clearly logged, not counted as PASS.
- **Smoke script step 4 IS a fake-pass route:** when no jobId from step 1, falls back to hardcoded `aabbccdd00112233`. `/api/topics/feedback` does not validate jobId existence (only zod hex regex), so step 4 always passes even when entire job pipeline is broken. **Recommendation:** add an explicit skip when step 1 jobs failed instead of silent fallback, OR document the false-positive risk in script header.

### 5. TTL / docs-drift (P1 — MUST FIX BEFORE COMMIT)

Code-truth table (verified by reading source):

| Key | Docs claim | Code (source-of-truth) | File | Status |
|---|---|---|---|---|
| `dislikes:<topicId>:<weekYMD>` | **14d** (deployment.md §13, privacy.md §5, §6) | **60d** (`60*24*60*60`) | `src/app/api/topics/feedback/route.ts:15` | DRIFT |
| `topic-feedback:<topicId>` (list) | **7d** (deployment.md §13, privacy.md §5, §6) | **no TTL set** (only `lpush`+`ltrim`) | `src/app/api/topics/feedback/route.ts:46` | DRIFT |
| `metrics:refresh:<YMD>` | **30d** (deployment.md §13) | **2d** (`86400*2`) | `src/app/api/jobs/refresh/route.ts:126` | DRIFT |
| `metrics:click:<jobId>:<YMD>` | 2d | 2d (`CLICK_TTL_S = 2*24*60*60`) | `src/app/api/r/[jobId]/route.ts:17` | OK |
| `embed-cache:<hmac>` | 6h (21600s) | 21600s | `src/lib/jobs/embed-cache.ts:5` | OK |
| `metrics:cost:<YMD>:<bucket>` | 90d | not verified in current pass — see `cost/guard.ts` line 11 sets key but no `.expire` adjacent. May be untracked. | `src/lib/cost/guard.ts` | NEEDS VERIFY |
| `kill-switch:<bucket>` | 24h | 86400s | `src/lib/cost/guard.ts:100` | OK |
| `refresh:cursor` | no TTL | no TTL | `src/app/api/jobs/refresh/route.ts:115` | OK |
| job-recommend quota | 12 signed / 5 anon | 12 / 5 | `src/lib/quota/consume-quota.ts:8,17` | OK |
| Cost warn/kill | $1 / $3 | $1 / $3 | `src/lib/cost/guard.ts:7-8` | OK |
| Cron schedule | `0 20 * * *` | `0 20 * * *` | `cv-ex-refactor/vercel.ts:17` | OK |
| privacy.md contact email | `privacy@example.com` (§6) **vs** `vinh2000ld11@gmail.com` (§1) | n/a | `docs/privacy.md:21,101` | INCONSISTENT |

**Fix recommendations:**

a) `docs/deployment.md` §13 line 330: change `TTL: 30d` → `TTL: 2d` for `metrics:refresh:<YMD>`.
b) `docs/deployment.md` §13 line 336: change `TTL: 14d` → `TTL: 60d` for `dislikes:<topicId>:<weekYMD>`.
c) `docs/deployment.md` §13 line 337: change `TTL: 7d` → `TTL: none (lpush+ltrim only, no expire)` for `topic-feedback:<topicId>`.
d) `docs/privacy.md` §5 line 86: `TTL: 14 ngày` → `TTL: 60 ngày` for dislikes counter.
e) `docs/privacy.md` §5 line 87: `TTL: 7 ngày` → `TTL: không (chỉ giới hạn 1000 entries qua ltrim)` for topic-feedback list.
f) `docs/privacy.md` §6 line 114: `7-14h topic feedback` → `60d dislikes counter; topic-feedback list không hết hạn`.
g) `docs/privacy.md` §6 line 101: unify takedown email with §1 (use real `vinh2000ld11@gmail.com` OR placeholder `privacy@example.com` — pick one; mixing is confusing).
h) Verify `metrics:cost:<YMD>:<bucket>` TTL claim (docs say 90d) — `cost/guard.ts` did NOT show an `.expire` call adjacent to the set. If actually no TTL, docs lie; if no TTL is intentional, doc must say `TTL: none`. **Defer to a quick re-read of `record-cost.ts` or wherever the bucket key is created.**

These are operator-facing accuracy issues. During a privacy takedown request or cost incident, an engineer reading the wrong TTL will issue the wrong cleanup script.

### 6. system-architecture.md — NEW file, no content lost

- `git log -- docs/system-architecture.md` returns empty → file is genuinely new.
- 405 LOC, under `docs.maxLoc: 800`.
- Not a regression.

### 7. Smoke script secret-logging — CLEAN

- `smoke-job-fit.sh`: `CRON_SECRET` only used in `-H "Authorization: Bearer $CRON_SECRET"` (line 188). No `set -x`, no `echo`/`printf` of the variable. Skip message at line 185 says `SKIP: CRON_SECRET not set` (no value).
- `smoke-job-fit.ps1`: `$CronSecret` only used in `Authorization = "Bearer $CronSecret"` header (line 182). No `Write-Host` of value. Line 179 skip message clean.
- Response preview (line 184 .ps1, line 190 .sh) prints first 200 chars of refresh response — refresh handler does NOT return the secret in its body. Safe.

---

## P2 Findings

### refresh-batch test coverage gap

- Test file does cover the http(s) allowlist (line 163: `non-http(s) sourceUrl → increments errors, skips fetch`). NOT a gap.
- Missing edge case: deadline guard mid-batch (deadline becomes past during iteration). Has "deadline already passed → 0 items" but not "deadline expires after item 1 of 3". Minor — P1.2 budget guard is simple enough that the all-zero case proves it.

### Changelog cosmetic

- `project-changelog.md:15` says "40+ files added across" — fine.
- `project-changelog.md:48` says "KV inventory (18 key patterns)" — actual deployment.md §13 has ~13-14 keys depending on count. Minor — round-down OK.

### Refresh-batch typo in route.ts

- `refresh/route.ts:99` comment "exclude already-auto-expired ids" — auto-expired ids were removed from `jobs:active` via `expireJob` → `smove` (atomic move to `jobs:expired`). After `expireJob`, `listActiveIds()` would no longer include them on NEXT tick — but `activeIds` array in current tick is a snapshot taken at line 76 BEFORE the sweep. So `autoExpiredIds` filter at line 100 is necessary and correct. Defensive coding, not a bug.

---

## P3 Findings

- `feedback-endpoint.test.ts` test data uses `react-hooks` topicId. After many CI runs, the `dislikes:react-hooks:<weekYMD>` counter on shared KV will be inflated → falsely show "react-hooks is universally disliked" in admin dashboard. Use a test-namespaced topicId (e.g., `test-topic-xxx`) AND clean up in afterAll.
- `recommend-endpoint-smoke.test.ts:55` asserts `job.overallScore > 80` — flaky if LLM returns lower scores on a borderline-fit CV. Consider `>= 0 && <= 100` for shape validation; assert score-band as separate optional check.
- `recommend-endpoint-smoke.test.ts:25` falls back to `'x'.repeat(300)` if fixture missing — this would also be < 200 char min in some configs, but 300 > 200 so passes. Then asserts response shape... but 300 chars of 'x' won't produce meaningful job matches → LLM may return 0 jobs → 502 path taken. Test handles this in `else` branch with `console.warn`. Acceptable but worth a comment.

---

## Behavioral Checklist

- [x] Concurrency: refresh-batch sequential + deadline-guarded; click metrics fire-and-forget via `Promise.allSettled`; no shared mutable state.
- [x] Error boundaries: integration tests handle 503/502 explicitly; smoke scripts have FAIL counter.
- [x] API contracts: schemas + zod parse + strict mode all tested.
- [x] Backwards compatibility: no schema changes to existing endpoints; new tests don't break existing.
- [x] Input validation: schemas-recommend-body covers length bounds, type checks, llm provider enum.
- [x] Auth/authz paths: refresh route uses `timingSafeEqual` for CRON_SECRET (P2.1).
- [x] N+1 / query efficiency: refresh-batch is sequential by design (polite crawl); ok in 5-min budget.
- [x] Data leaks: smoke scripts do not log CRON_SECRET; redirect handler does not log sourceUrl beyond warn-on-malformed; feedback endpoint refuses `reason` field (PII channel closed).

---

## Recommended Actions (ordered)

1. **Fix docs drift items a-f above** (TTL/email corrections in `deployment.md` + `privacy.md`). 10-min edit.
2. Verify `metrics:cost:<YMD>:<bucket>` TTL claim against `record-cost.ts` source. Fix doc or code as appropriate.
3. **Add cleanup to `feedback-endpoint.test.ts`** — `afterAll` deletes `topic-feedback:react-hooks` + `dislikes:react-hooks:<weekYMD>`. Or namespace topicId to `test-xxx`.
4. (Optional) Update smoke script step 4 to skip explicitly when no jobId from step 1, instead of silent fallback.
5. After fixes, commit. Consider squash to a single Phase 5 commit per project convention.

---

## Unresolved Questions

1. `metrics:cost:<YMD>:<bucket>` TTL — docs claim 90d but no `.expire` call seen adjacent to `kv.incr` / `kv.set` for that key in `guard.ts`. Need a quick read of the cost-recording call site (`record-cost.ts` or wherever bucket is set initially) to confirm.
2. Test agent labeled `topics-feedback-schema.test.ts` as a "stub" — was that wording in their handoff a mistake, or were they referring to a different file (e.g., expected to find a separate stub that never existed)? Worth a quick sanity check on the test report's framing before relying on its other claims.

---

**Status:** APPROVE_WITH_FIXES
**Summary:** Tests are real, scripts secure, code clean. Three TTL drift items in docs would mislead operators during incident response — fix before commit. Vietnamese regex is fine (test agent misdiagnosed). Smoke step 4 has a benign fake-pass route; suggest tightening.
**Concerns/Blockers:** Docs TTL drift (P1, 6 lines across 2 files). Pending verify on `metrics:cost` TTL claim.
