# Phase 00 — Hardening

## Context Links
- Spec: `plans/reports/spec-260529-1031-job-fit-study.md` (Phase 0 section, items 1-9)
- Existing admin gate: `cv-ex-refactor/src/lib/usage/admin-auth.ts`
- Existing alert webhook: `cv-ex-refactor/src/lib/usage/alert-webhook.ts`
- Existing quota: `cv-ex-refactor/src/lib/quota/consume-quota.ts`
- KV client: `cv-ex-refactor/src/lib/quota/kv-client.ts`
- Env loader: `cv-ex-refactor/src/lib/env.ts`

## Overview
- **Priority:** P0 — blocks Phase 1+
- **Status:** pending
- **Description:** Pre-feature security and infra prep. 9 items. No new feature surface. All items must pass before Phase 1 starts.

## Key Insights
- `cv-ex-refactor/src/proxy.ts` **already exists** from v0.2 (visit counter via SADD per-day IP set). Phase 0 modifies its matcher to exclude `/api/jobs`, `/api/topics`, `/api/r` so visit counter does not bump on backend traffic. **DO NOT create middleware.ts.**
- Admin gate already exists (`admin-auth.ts`) — only audit `ADMIN_USER_IDS` is set in prod env (Vercel). No code change needed if env present.
- Alert webhook exists (`alert-webhook.ts`) and currently keys on `sharedCallsToday`/`sharedCostMicroUsd`. Cost guard reuses pattern: per-bucket cost accumulator + kill-switch flag.
- Quota bucket addition (`job-recommend`) is one line in `consume-quota.ts` — does **not** ship anywhere else until Phase 2 consumes it. Safe to land now.
- `topic-feedback` schema must drop `reason` free-text field (privacy: prevents free-form PII collection through feedback channel).

## Requirements

### Functional
- F1. `ADMIN_USER_IDS` env present in prod; if missing → admin routes deny.
- F2. `EMBED_CACHE_SECRET` env present (≥32 random bytes hex); used for HMAC cache keys.
- F3. CV-derived cache keys are KV-only with TTL ≤ 6h (no module memory).
- F4. `topic-feedback` payload schema: `{ jobId, topicId, action: 'dislike' }` — no `reason` string.
- F5. Cron refresh skeleton enforces ≥2000ms delay between outbound requests + ±500ms jitter + custom UA.
- F6. `proxy.ts` matcher updated to exclude `/api/jobs`, `/api/topics`, `/api/r` from visit-counter side effects (modify existing v0.2 file).
- F7. Cost guard: `metrics:cost:<YMD>:<bucket>` accumulator + `kill-switch:<bucket>` flag + warn at $1, kill at $3.
- F8. Ingest CLI documented to read `.env.local`; `.gitignore` confirms `data/seed-jobs.json` is checked in but `.env.local` is not.
- F9. `docs/privacy.md` skeleton created with 4 disclosure sections (CV embedding cache, JD-to-LLM, vertical classifier, redirect tracking).

### Non-functional
- Zero runtime impact on existing endpoints (analyze/career-path/generate-cv).
- All env reads through `env.ts` (no `process.env` direct access).
- KV access wrapped with `kvAvailable` guard (existing pattern).

## Architecture

### Cost guard data flow

```
Endpoint → (before serve) costGuard.check(bucket)
                              ├─ kv.get('kill-switch:<bucket>') === '1' → 503 + reason
                              └─ kv.get('metrics:cost:<YMD>:<bucket>') > $3M → set kill-switch, alert
Endpoint → (after LLM call) costGuard.record(bucket, microUsd)
                              ├─ kv.incrby('metrics:cost:<YMD>:<bucket>', microUsd)
                              ├─ kv.expire(..., 86400 * 2)
                              └─ maybeFireAlerts(bucket, total)  (warn at $1M)
```

### Proxy matcher update (existing v0.2 visit counter)

```
proxy.ts (existing): increments visits:total + SADD ipset on each real page nav
                     existing matcher already excludes /api/*, /_next/*, /favicon

Phase 0 update: confirm matcher EXPLICITLY excludes new paths:
  /api/jobs/*, /api/topics/*, /api/r/*
  (likely already covered by /api/* wildcard — verify regex/glob form,
   add explicit exclude if matcher uses include-list pattern)
```

## Related Code Files

### New
- `cv-ex-refactor/src/lib/cost/guard.ts` — `checkKillSwitch(bucket)`, `recordCost(bucket, microUsd)`, `KILL_SWITCH_LIMIT_USD = 3`, `WARN_LIMIT_USD = 1`.
- `cv-ex-refactor/src/lib/cost/buckets.ts` — `type CostBucket = 'job-recommend' | 'analyze' | 'career-path' | 'generate-cv'` (constants).
- `cv-ex-refactor/docs/privacy.md` — 4-section skeleton.

### Modified
- `cv-ex-refactor/src/proxy.ts` — verify/update matcher to exclude `/api/jobs`, `/api/topics`, `/api/r`. Read existing implementation first; if matcher already uses broad `/api/*` exclude, just add a code comment listing new paths. Body change should be minimal (regex or `startsWith` list).
- `cv-ex-refactor/src/lib/quota/consume-quota.ts` — append `'job-recommend': 12` to `QUOTA_LIMITS` and `'job-recommend': 5` to `ANON_QUOTA_LIMITS`; widen `QuotaKind` union; update `isQuotaKind`.
- `cv-ex-refactor/src/lib/env.ts` — add typed entries: `ADMIN_USER_IDS` (existing), `EMBED_CACHE_SECRET` (new, required for prod), `ALERT_WEBHOOK_URL` (existing).
- `cv-ex-refactor/.env.example` (create if missing) — add `EMBED_CACHE_SECRET=<openssl rand -hex 32>` template.
- `cv-ex-refactor/.gitignore` — confirm `.env.local`, `.env*.local` excluded; add `data/embeddings-cache/` if applicable (no — KV only).

### Audited (no edits unless gap found)
- `cv-ex-refactor/src/lib/usage/admin-auth.ts` — confirm pattern is sufficient.
- `cv-ex-refactor/src/lib/usage/alert-webhook.ts` — confirm reuse path for cost guard.

## Implementation Steps

1. **Env audit.** Open `src/lib/env.ts`. Add `EMBED_CACHE_SECRET: z.string().min(32).optional()` (optional in dev, required check at runtime call sites). Confirm `ADMIN_USER_IDS` already exists; if not, add as optional comma-separated string.
2. **Quota bucket.** Modify `consume-quota.ts`:
   - Append `'job-recommend': 12` to `QUOTA_LIMITS`.
   - Append `'job-recommend': 5` to `ANON_QUOTA_LIMITS`.
   - Update `isQuotaKind` to include `'job-recommend'`.
   - Add `'job-recommend'` to the union of `QuotaAction` (no helper alias needed).
3. **Cost guard buckets.** Create `src/lib/cost/buckets.ts`. Export `CostBucket` type alias.
4. **Cost guard core.** Create `src/lib/cost/guard.ts` (<200 LOC):
   - `WARN_LIMIT_MICRO_USD = 1_000_000`
   - `KILL_LIMIT_MICRO_USD = 3_000_000`
   - `async function checkKillSwitch(bucket): Promise<{ ok: boolean; reason?: string }>` — read `kill-switch:<bucket>` flag.
   - `async function recordCost(bucket, microUsd, ymd?): Promise<void>` — `kv.incrby('metrics:cost:<YMD>:<bucket>', microUsd)`, `kv.expire(...)`, if cumulative > kill → `kv.set('kill-switch:<bucket>', '1', { ex: 86400 })` and fire webhook. If > warn → fire warn webhook (dedup via `alert:sent:<YMD>:cost:<bucket>` SETNX, same pattern as `alert-webhook.ts`).
   - Fail-open: kv error logs and returns `{ ok: true }`.
5. **Proxy matcher.** Open `src/proxy.ts` (existing v0.2 visit counter):
   - Read current matcher/config and exclude logic.
   - If matcher is a regex/glob: ensure `/api/jobs`, `/api/topics`, `/api/r` are excluded (likely already by `/api/*`).
   - If matcher is a `startsWith` allowlist of paths: add explicit excludes.
   - Add inline comment: `// excludes: /api/jobs, /api/topics, /api/r added v0.3 (Phase 0)`.
   - Test locally: hit `/api/jobs/recommend` (stub) → `visits:total` should NOT increment; hit `/` → should increment.
6. **Drop reason field.** Confirm spec data model `topic-feedback`: `{ jobId, topicId, action: 'dislike' }`. No code yet (route is Phase 4) — capture as a regression test stub in `tests/topics-feedback-schema.test.ts` (a single test asserting no `reason` key accepted; route to be written in Phase 4 will satisfy it).
7. **Refresh cron rate-limit doc.** Add note in `docs/deployment.md` (or create stub) describing required `User-Agent: ResumeRefineRefreshBot/1.0` + `≥2000ms` between requests + `±500ms` jitter. Code lives in Phase 4 but the rule is documented now.
8. **Ingest CLI gitignore.** Verify `.gitignore` covers `.env.local`. Confirm `data/seed-jobs.json` will be committed (small JSON, no secrets) — add explicit `!data/seed-jobs.json` if a broad rule excludes `data/`.
9. **Privacy doc skeleton.** Create `docs/privacy.md` with sections:
   - "CV embedding cache" — HMAC key, TTL 6h, KV-only, no PII logging.
   - "JD-to-LLM" — JD text passed to Gemini Flash, no retention beyond model TOS.
   - "Vertical classifier" — heuristic only, no LLM call, runs server-side at ingest.
   - "Redirect tracking" — `/api/r/[jobId]` records metric only (jobId + day bucket), no user PII.

## Todo List
- [ ] H0.1 Verify `ADMIN_USER_IDS` set in prod (Vercel env)
- [ ] H0.2 Add `EMBED_CACHE_SECRET` to env schema + Vercel prod env (32+ bytes hex)
- [ ] H0.3 Modify `consume-quota.ts` add `job-recommend` bucket (12/5)
- [ ] H0.4 Create `lib/cost/buckets.ts`
- [ ] H0.5 Create `lib/cost/guard.ts` (<200 LOC) with warn $1 / kill $3
- [ ] H0.6 Update `src/proxy.ts` matcher to exclude `/api/jobs`, `/api/topics`, `/api/r` (modify existing v0.2 file)
- [ ] H0.7 Create `docs/privacy.md` skeleton (4 sections)
- [ ] H0.8 Document refresh-cron rules in `docs/deployment.md` (or scratch note in plan)
- [ ] H0.9 Confirm `.gitignore` excludes `.env.local` and explicitly allows `data/seed-jobs.json`
- [ ] H0.10 Stub `tests/topics-feedback-schema.test.ts` (asserts no `reason` accepted)
- [ ] H0.11 Compile check: `npm run build` clean
- [ ] H0.12 Smoke: cost guard `checkKillSwitch('job-recommend')` returns ok by default

## Success Criteria
- `npm run build` passes with no TS errors.
- `EMBED_CACHE_SECRET` and `ADMIN_USER_IDS` confirmed present in Vercel prod env (manual check + screenshot in PR).
- Cost guard `checkKillSwitch('job-recommend')` unit-callable, returns `{ ok: true }` when KV empty.
- `consume-quota` test extended to assert `job-recommend` bucket = 12 user / 5 anon.
- Privacy doc exists with all 4 sections (non-empty).

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `EMBED_CACHE_SECRET` missing in prod | M | H | Fail closed in Phase 2 route if secret missing (return 503 with "config error"); add to Vercel env in Phase 0 PR |
| Proxy matcher edit breaks existing v0.2 visit counter | M | H | Read existing `proxy.ts` first; verify current matcher behavior with curl; minimal edit (add path to existing exclude list, do not refactor); test all routes: `/`, `/refined-cv`, `/career-path`, `/api/analyze`, `/api/career-path`, `/api/jobs/recommend` (stub) — only public app routes should bump `visits:total` |
| Cost guard double-firing alerts | L | M | Reuse `alert:sent:<YMD>` SETNX dedup pattern from `alert-webhook.ts` |
| Quota change breaks existing analyze counter | L | H | Append-only edit to `QUOTA_LIMITS`; no key rename. Run existing quota tests. |
| Kill-switch flag accidentally activated → blocks ship | L | M | Manual `kv.del('kill-switch:job-recommend')` override documented in `docs/deployment.md` runbook |

## Security Considerations
- `EMBED_CACHE_SECRET` rotation: documented in privacy.md as "rotate quarterly; old cache keys auto-expire in 6h."
- Admin gate: `isAdminId` already rejects empty/missing — re-verify with empty `ADMIN_USER_IDS` env returns `false`.
- Privacy doc must list **exact KV keys** that store CV-derived data so users can request deletion (Vietnam PII discussion, gate of deploy).
- Middleware must NOT log request bodies — only path-level decisions.

## Next Steps
- **Blocks:** Phase 1 (CLI needs `EMBED_CACHE_SECRET` for embed test path; quota bucket needed by Phase 2 endpoint).
- **Unblocks after merge:** Phase 1 ingest CLI can begin immediately.
- **Dependencies:** None (Phase 0 is the floor).
