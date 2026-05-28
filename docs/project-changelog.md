# Project Changelog

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

