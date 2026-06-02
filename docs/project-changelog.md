# Project Changelog

## v0.3 — 2026-06-02 (Job Fit & Study + LLM batch recommendations)

### Features

#### Job Fit & Study (`/job-fit`, `/job-fit/[jobId]`)
- **Recommendation pipeline:** Single `/api/jobs/recommend` POST call returns 5-10 jobs matching CV, scored on 9 dimensions (tech skills, domain knowledge, seniority fit, learning curve, remote, growth, location, industry, soft skills).
- **Study topics per job:** Each recommendation includes 5-10 curated learning topics with tier (basic/intermediate/advanced), estimated hours, and job-specific rationale.
- **Job detail page:** Read-only 9-dim score sliders (user can override sliders client-side to recompute overall score, test match sensitivity).
- **Sidebar navigation:** Added "Job Fit & Study" as 5th nav item after Career Path.
- **Cursor redirect & engagement tracking:** User clicks "Apply" → `/api/r/[jobId]` → records click metric → 302 external redirect.
- **Topic dislike feedback:** User click "Không thích" on topic → `/api/topics/feedback` POST → aggregates dislike counters and logs.

Files added: 40+ across `src/lib/jobs/`, `src/features/job-fit/`, `src/app/api/jobs/`, `src/app/api/r/`, `src/app/api/topics/`, `src/components/job-*`.

#### Ingest CLI (`npm run ingest`)
- Interactive paste mode, file batch import, job stats display, manual expiry, embedding rebuild.
- 150-job seed dataset (80 tech, 30 marketing, 20 finance, 20 sales/ops) pre-embedded.
- Auto-classifies vertical (tech/finance/marketing/etc) + seniority (intern/junior/mid/senior/lead) from title + company.

#### Infrastructure

**Cost guard + kill-switch:**
- Per-bucket daily spend tracking (`metrics:cost:<YMD>:<bucket>`).
- Alert webhook fires at `ALERT_SHARED_DAILY_COST_USD` (default $2.50) and `ALERT_SHARED_DAILY_CALLS`.
- Hard kill-switch at $3/day cumulatively — endpoint returns 503 until cost guard manually reset.

**Cron refresh pipeline:**
- Vercel Cron Pro: `0 20 * * *` (20:00 UTC = 3am ICT) daily.
- HEAD/GET each job source URL; mark expired (404/410) or verify (200 + title match).
- Auto-archive jobs with `verifiedAt > 21 days`.
- Cursor-based resumable batch (150 jobs × 2s/req = ~5min, fits 300s deadline).
- Alert webhook if active pool < 50 jobs.

**New quota bucket:**
- `job-recommend`: 5 calls/day anon, 12 calls/day signed-in, unlimited BYOK.

**Environment variables added:**
- `EMBED_CACHE_SECRET`: HMAC key for CV embedding cache (TTL 6h).
- `CRON_SECRET`: Vercel cron auth Bearer token (auto-injected on Pro tier).
- `ALERT_WEBHOOK_URL`: Optional Slack/Discord webhook for cost/pool warnings.

### Privacy & Documentation

**Docs expanded (v0.3 blocking):**
- `docs/privacy.md`: All 6 sections now include concrete KV keys, TTLs, deletion process, and new GDPR-aligned "takedown channel" email + 7-day SLA.
- `docs/deployment.md`: Full runbook with env var table, KV inventory (18 key patterns), quota bucket table, phase rollback procedure, smoke checklist.
- `docs/system-architecture.md`: New "Job Fit & Study" subsection with data-flow diagram (Mermaid), cost reference, privacy reference.
- `docs/development-roadmap.md`: v0.3 marked shipped; post-ship monitoring 2-week window (30% activation, 40% engagement, <15% dislike, 15% CTR).

### Testing

- Unit tests: cosine similarity, embedding pack/unpack roundtrip, vertical + seniority classifiers, normalization, refresh batch with mocked fetch.
- Schema tests: recommend body validation, topic feedback strict schema (rejects `reason` field).
- Integration smoke tests: recommend endpoint (env-gated), redirect 302, feedback 204/400.
- Smoke bash script: cacheable embed, hit redirect, invalid feedback rejection.
- Test coverage: 40+ test cases across 8 test files.

### Migration notes

**v0.2 → v0.3:**
- No data migration needed (KV-only, per-session CV text).
- New quota bucket `job-recommend` starts fresh (no historical data).
- `EMBED_CACHE_SECRET` required in production — rollback impossible without it.
- Cron schedule added to `vercel.ts` — type-check before deploying.

### Known limits & deferred

- **No playwright scraper** (v0.3a manual paste only; v0.3b planned for live scrapers).
- **No resource links per topic** (planned v0.3.5 to reduce hallucination risk).
- **No auth-tied job history** (client-side sessionStorage only; persistent tracking deferred to v0.4).
- **Topic feedback counters only** — no free-text reason field (privacy-first approach).

### Commits

- P0 hardening: `2bea204`
- P1 ingest + seed: `2b4692a`
- P2 recommend endpoint: `e16e802`
- P3 UI pages: `fe97bd5`
- P4 cron + redirect + feedback: `aaf7470`
- P5 tests + docs + smoke: `[commit hash TBD on merge]`

---

## v0.2 — 2026-05-28 (Career Path + UX hardening)

### Features

#### Career Path (`/career-path`)
Phase 2 stub replaced with full feature.
- **Auto-suggest paths**: on landing with analyzed CV, AI proposes 3-5 concrete role suggestions across trajectories (specialist / leadership / pivot / breadth). User picks one to focus the roadmap.
- **Roadmap generator**: per-aspiration LLM call returns structured response — `currentSnapshot`, `targetRole` (with fit score), 3-6 milestones (year offset, role, responsibilities, skills, evidence, certifications), skill gaps with current→target level meter, alternative paths, 30/60/90-day quick wins.
- **Natural mode vs targeted mode**: prompt detects whether aspiration is empty (`auto` target, no focus areas, no notes) → instructs LLM to infer natural progression from CV trajectory. Otherwise builds toward stated aspiration.
- **Feasibility check**: LLM judges feasibility first; unrealistic aspirations get a warm tertiary banner + pragmatic alternative + still renders a usable roadmap toward the alternative (no hard-fail).
- **Per-page state**: `useCareerPath` Zustand store persists to sessionStorage. Suggestion cache keyed by first 200 chars of CV — auto-invalidates when user re-analyzes a different CV.

Files:
- `src/app/api/career-path/{route.ts, suggest/route.ts}`
- `src/features/career-path/*.tsx` (8 blocks + store + actions + page)
- `src/lib/llm/{prompt-career-path, prompt-suggest-paths, normalize-career-path, normalize-suggest-paths}.ts`

#### Visit counter (header)
KV-backed analytics visible in topbar as social-proof / pilot metric.
- `proxy.ts` increments counters fire-and-forget on each real page nav (matcher already excludes API/static/prefetch).
- Unique-visitor dedup via Redis `SADD` against per-day IP set — reliable on Upstash @vercel/kv.
- `GET /api/visits` returns `{ total, totalUnique, today, todayUnique }`, edge-cached 30s.
- `VisitsBadge` polls every 60s, displays unique count (falls back to total page views).
- Privacy: IP only stored as transient dedup marker (1-day TTL), never as identity.

Files: `src/lib/analytics/visit-counter.ts`, `src/app/api/visits/route.ts`, `src/features/nav/visits-badge.tsx`

### Infrastructure

- **Upstash KV reconnected to production** (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.). Previous deploy lost the integration → BYOK vault returning 503 and quota fail-open. Re-linked via Vercel Storage tab.
- **New quota bucket**: `career-path` (3/day signed-in, 2/day anon). `career-path-suggest` is passthrough (no quota debit) with 10/min IP rate limit instead.
- **Token budget buff**: `callLLM` accepts `maxOutputTokens` per-call. Career-path roadmap uses 24576 Gemini / 8192 OpenAI; suggest uses 4096 / 2048. Prevents JSON truncation on larger schemas.
- **Git auto-deploy unblocked**: pushes to `main` now auto-deploy (previous Git Author Trust block resolved).

### UX fixes

- **Nav state preserved across pages**: sidebar now uses `next/link` instead of raw `<a href>` — was triggering full page reload that wiped zustand stores. Analyzing a CV then navigating to Career Path no longer loses `cvText` / `result`.
- **Analyze state persists across F5**: `useAnalysis` store now wraps in `persist` middleware against sessionStorage. Survives reload within the same tab; auto-clears on tab close (privacy: CV text doesn't linger for the next user on a shared device).
- **Primary CTA visibility**:
  - Brand `primary` token softened from pure black `#000000` → tertiary blue `#3980f4`. Every enabled CTA (Analyze, Generate Roadmap, Go to Analyze...) now reads as an action color, not a harsh black box. Section header labels (`text-primary`) also blue now — visually consistent.
  - `primary-container` / `on-primary-container` realigned to the same blue family (were inverted: dark navy + medium gray → text invisible).
  - Disabled state uses `bg-surface-container-high text-primary/60 border border-primary/25` — clearly distinct from enabled, still readable, still recognisable as primary action waiting to enable.
- **Aspiration toggle is now a proper `Button variant="secondary"`** instead of a link-style raw `<button>`.
- **Quota badge removed from topbar** — it added clutter; replaced with visit counter as the more meaningful signal.

### Error handling

- **`humanizeLlmError` extracted to `src/lib/llm/humanize-error.ts`** — analyze, generate-cv, and career-path api-clients all consume it (DRY). Friendly Vietnamese messages for timeout / network / 401-403 / 429 / 5xx / JSON truncation / "high demand". Career-path no longer surfaces raw `Gemini 503: { error: ... }` payloads.
- **`resolve-api-key` missing-shared-key status**: returned 500 + `llm_provider_error`, now 503 + `shared_key_disabled` with actionable message pointing to Settings → BYOK. Aligns HTTP semantics (server config, not internal error).
- **Career-path empty-payload guard**: relaxed. Previously hard-failed when LLM returned 0 milestones. Now only fails when both milestones AND feasibility advice are empty — lets the LLM return a banner-only response for genuinely-unrealistic aspirations.

### Deferred (non-blocking)

- `src/lib/usage/read-usage.ts` admin aggregation doesn't include `career-path` / `career-path-suggest` keys yet → admin dashboard underreports those endpoints. Counters write to KV correctly; only the read-side aggregation is missing.
- `docs/deployment.md` doesn't yet document the new quota buckets or the visit-counter KV keys. Update before next deploy doc revision.
- Visit counter `totalUnique` shows 0 for visits that landed before SADD-based dedup deployed — data loss is historical and won't backfill. Going forward unique tracking is accurate.

---

## v0.1 — 2026-05-27 (Pilot launch)

See `memory/project_cvmatching_v01_state.md` for full v0.1 state. Brief:

- Pilot deployed via Vercel CLI; BYOK vault (AES-GCM + KV TTL 4h + httpOnly cookie); anonymous shared-key path with per-IP quota (3 analyze + 1 rewrite/day); CSP `strict-dynamic` + nonce + HSTS 2y; admin dashboard at `/admin/usage`; alert webhook thresholds.

