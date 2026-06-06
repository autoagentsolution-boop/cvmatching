---
date: 2026-06-06
end_time: 18:19
plan: 260606-1231-jobfit-db-pool-monetize
phases_shipped_today: [5, 6, 7]
commits: [0660bea, c9ac0ca, 2287b9a, a50ba0b]
test_count_delta: 388 → 435 (+47)
---

# Session report — 2026-06-06 EOD

## Summary

7 of 8 phases of `jobfit-db-pool-monetize` shipped + pushed to main + Vercel auto-deployed. SePay monetization code complete but hidden behind `MONETIZATION_ENABLED=1` default-off gate (pricing not finalized). Phase 8 (KV decommission) is the only thing left, deferred to next session pending Phase 4 stability soak + first TopCV/VNW operator ingest run.

## Today's commits (pushed to origin/main)

| Commit | Phase | LOC |
|---|---|---|
| `0660bea` | Phase 6 — SePay VietQR checkout + webhook + /upgrade | 15 files, ~700 LOC |
| `c9ac0ca` | Phase 7 — 90d dedup TTL + exhausted-pool UX + admin reset | 11 files, +418/-18 |
| `2287b9a` | Phase 5 — TopCV + VNW scraper runners | 7 files, +662/-35 |
| `a50ba0b` | Hide SePay until pricing ships | 8 files, +48/-23 |

## Phase 6 — SePay monetization (code complete, dormant)

### What shipped
- `src/lib/payments/{sepay-qr,sepay-match,subscriptions}.ts` — VietQR builder, multi-strategy webhook matcher (content-parse → amount-window → amount-only), renewal-by-transfer activator (stacks +30d on existing window)
- `src/lib/users/ensure-user-row.ts` — lazy upsert (NextAuth JWT has no Adapter)
- `/api/checkout/sepay` (POST, auth-gated) → mint order + return QR
- `/api/orders/[id]/status` (GET) → owner-scoped poller, lazy-expires at 30min
- `/api/webhooks/sepay` (POST) → timing-safe Apikey auth, PK-conflict idempotency on sepay_webhook_events, always-200 contract, sequential state flip
- `/upgrade` page + 3s client poller (10-min cap), bilingual VN/EN copy
- nav `UpgradeLink` (server component, free-tier only)
- env.ts: SEPAY_* + PAID_PLAN_PRICE_VND + MONETIZATION_ENABLED keys
- 18 tests: parser tolerates bank dash-strip, dedup, malformed memos
- docs/deployment.md §3 env table + §7 runbook (kill switch, dashboard, idempotency, manual replay)

### Plan deviation
- Skipped `sepay-webhook` cost-guard bucket (existing CostBucket is strictly LLM-cost; webhook has no LLM call). Documented in plan + memory.

## Phase 7 — Dedup + exhausted-pool UX

### What shipped
- `repo-postgres.topKByEmbedding` NOT EXISTS clause now scopes to `seen_at > now() - interval '90 days'` — sliding window resurfaces stale-seen jobs
- `mark-seen-for-user.ts` extended with `seenCountForUser` + `clearSeenForUser` (kept same module per dev-rules)
- `/api/admin/seen/reset` (POST) — self (anyone authed) or ?userId=X (admin only)
- `recommend` route: on candidates=0, returns `{exhaustedPool, seenCount, message: 'no_more_new_matches'|'pool_empty'}` so UI disambiguates dedup-exhaustion from empty vertical
- `src/lib/client/anon-seen.ts` — sessionStorage helpers, cap 50, SSR-safe (try/catch every storage access), dedup keeps most-recent-wins
- `api-client.fetchRecommendations` reads seenIds before + appends jobIds after
- `ExhaustedPoolBanner` — bilingual, reason-driven copy, Reset CTA (signed-in), Upload-new-CV CTA
- `job-fit-list-page.tsx` — per-field zustand selectors (per `feedback_zustand_object_literal_selector`), banner replaces generic ErrorState
- 9 tests: anon-seen sessionStorage with in-mem Storage polyfill

### Plan deviation
- Did NOT split into separate `seen-store.ts` per phase doc; extended existing `mark-seen-for-user.ts` per dev-rules. Filename now slightly mismatched (3 fns, not just markSeen). Phase 8 cleanup candidate.
- No rate-limit on `/api/admin/seen/reset` (plan listed risk L/L). YAGNI.
- No real-Postgres integration test for 90d TTL (pure SQL fragment, fails loudly on syntax mistake).

## Phase 5 — TopCV + VNW scrapers

### What shipped
- `src/lib/scrape/jsonld-itemlist.ts` — extracted `extractItemListUrls` from ITviec for DRY across 3 scrapers
- `scripts/ingest-topcv.ts` — TopCV listing URL builder, dual discovery (JSON-LD ItemList → `/viec-lam/{slug}-{id}.html` regex), normalizeTopcvSlug accepts 4 input forms
- `scripts/ingest-vnw.ts` — VNW URL builder, triple discovery cascade (JSON-LD → `__NEXT_DATA__` JSON walk → `-{id}-jv` regex), normalizeVnwSlug accepts 3 forms
- `scripts/ingest-jobs.ts` — COMMANDS + switch + help text register `topcv` + `vnw`
- Each discovery layer logs which path won so operator spots scraper drift instantly
- 20 tests: jsonld-itemlist, slug normalizers, regex extractors, __NEXT_DATA__ walker

### Reuses existing infrastructure (no new parsers needed)
- `urlToJobInput` in `scripts/ingest-urls.ts` already routes by hostname → handles topcv.vn + vietnamworks.com out of the box
- `parseJobPostingLd` from `vl24h-parser.ts` handles Google for Jobs JSON-LD on detail pages
- `ingestEntries` pipeline writes via repo-postgres (Phase 02 cutover already complete)

### Plan deviation
- No `taxonomy.SOURCES.topcv/vnw` slug whitelist. Operator runs scraper with explicit slug args = filter. Whitelist would force code-edit for new category — YAGNI for pilot.
- No listing-time title positive/negative regex. Post-ingest classifier already rejects off-vertical noise.
- No separate `topcv-parser.ts` / `vnw-parser.ts`. Shared urlToJobInput + parseJobPostingLd handle both; only listing-discovery is source-specific, lives in script files.

### Operator-pending before pool actually grows
1. Curl probe TopCV nav → record real category slugs per vertical
2. Curl probe VNW nav → same
3. `pnpm run ingest topcv <slug> --dry-run --pages 1` → validate discovery cascade
4. Real ingest: `--pages 3`, lather rinse repeat per vertical until target hit

## Hide-SePay flip (commit a50ba0b)

User decision mid-session: hide SePay because no pricing plan yet.

### Centralized check
`src/lib/monetization/flag.ts` exports `isMonetizationEnabled()` (default-off; requires `=1` or `=true` to enable). Swapped 5 call sites to use it.

### Behavior when off (current prod state)
| Surface | Behavior |
|---|---|
| `/upgrade` | Redirect to `/job-fit` |
| `/api/checkout/sepay` | 503 monetization_disabled |
| `/api/webhooks/sepay` | 503 monetization_disabled |
| nav "Upgrade to Pro" pill | Not rendered |
| **signed-in tier** | **`paid`** (full 10-job quota, all tier letters) |
| anon tier | `anon` (1 teaser tier-B) — unchanged |

### Why auto-promote signed-in users
Without `/upgrade` path, leaving signed-in at `free` (2-job cap) strands them with no escape. The `subscriptions` table stays the source of truth — when monetization is re-enabled, anyone without an active row drops back to `free` automatically.

## Test counts

- Start of day (post-Phase 4): 388 passed / 10 skipped
- End of day (post-everything): 435 passed / 10 skipped — net +47

## Current prod state

- Vercel auto-deployed `a50ba0b` from main push
- `JOBFIT_USE_POSTGRES=1` (Postgres recommend path live)
- `MONETIZATION_ENABLED` unset → SePay surfaces hidden + signed-in get paid quota
- 171 jobs in Neon, distributed across 6 verticals
- Seen-job dedup active end-to-end (signed-in: SQL 90d TTL; anon: sessionStorage 50-cap)

## What's left in the plan

### Phase 8 — Cutover + KV decommission (3-5h, deferred)

Wait ~72h post-Phase 4 stability + after first TopCV/VNW operator ingest cycle confirms scrapers work. Then:
- Audit-snapshot export of legacy KV `jobs:active`, `embeddings:active:*`, `jobs:by-vertical:*` keys
- Drop those KV keys
- Remove `score.ts`, `pack-embeddings.ts`, `vertical-index.ts` (KV recommend path code)
- Remove `USE_POSTGRES` branching in recommend route
- env.ts: make DATABASE_URL required, drop JOBFIT_USE_POSTGRES
- Mark plan complete

## Open questions (carry to next session)

1. Pricing plan for SePay — when decided, flip `MONETIZATION_ENABLED=1` and behavior auto-restores
2. Whether to keep `mark-seen-for-user.ts` filename or rename to `seen-store.ts` during Phase 8 cleanup (filename now misnames its 3-function payload)
3. Whether to add a `taxonomy.SOURCES.topcv/vnw` whitelist post-pilot once a small set of high-yield slugs is identified — current operator-driven model works for pilot but won't scale to cron-driven ingest later
