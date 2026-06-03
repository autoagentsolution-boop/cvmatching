# Project Changelog

## Post-Wave-A hardening — 2026-06-03 evening

Wave A shipped in the afternoon (entry below); the evening session added
latency fixes, a refine-notes split that prevented meta leakage into
downloaded CVs, the foundation for the multi-vertical ingest taxonomy
(Phase 1 of 5), and a Dashboard landing page with the project tagline.

### Recommend latency: 504 → ~15-20s (commits `1027f5d`, `79c283b`, `6807047`, `8e2a710`)

After Wave A bumped the recommend output to 10-15 jobs with full
dimensionScores + study topics + the new few-shot prompt, `/api/jobs/recommend`
hit the 60s Vercel maxDuration. Vercel logs showed `generateContent: 54.23s`
on Gemini 2.5 Flash. Root cause was the 2.5-series default thinking budget,
not output size. Fixes layered in order:

- topK `10 → 6` in route.ts; dropped 16K → 24K retry path in
  `llm-call-with-retry.ts`; cut the 11-job worked-example block from the
  recommend prompt to shed ~500 input tokens.
- Added `disableThinking` opt threading through `callGemini → providers →
  callLLM`. Set `thinkingConfig.thinkingBudget: 0` for `job-recommend`,
  `generate-cv`, `generate-cover-letter`. Left thinking ON for
  `career-path` (genuinely open-ended roadmap reasoning) and `analyze`.
- Surfaced a `pool: { cvVertical, verticalApplied, verticalBucketSize,
  candidatesScored }` block in the recommend response so devtools shows
  which path the request took. Dropped UI underfill threshold 10 → 6 to
  match topK so the footer doesn't permanently scream "underfilled".
- vl24h slug map tightened: `khoa-hoc-ky-thuat`, `co-khi-o-to-tu-dong-hoa`,
  `dien-dien-tu-dien-lanh`, `buu-chinh-vien-thong` moved tech → other.
  Re-classified the 150 live prod jobs via REST + rebuilt vertical-index.
  Tech bucket 25 → 9 (still narrow; Phase 2-4 of the new plan fix the
  underlying pool composition).

### Refine notes split (commit `68fb45c`)

User reported that `## Changes Made` and `## Gaps To Address Before Interview`
sections were appearing INSIDE the rendered refined CV and inside the
downloaded `.md` file — meaning the candidate could ship internal meta
to recruiters as part of the CV.

Fix end-to-end:

- `prompt-generate-cv.ts` restructures OUTPUT FORMAT — model emits the CV,
  then a literal `<!--REFINE-NOTES-->` line, then meta as `### Changes
  Made` + `### Gaps To Address Before Interview`. Mode addenda (fill-gaps,
  stretch) now point the LLM at the notes block, not the CV body.
- `app/api/generate-cv/route.ts:splitCvAndNotes()` splits at the marker
  first; falls back to the first `## Changes Made` / `## Gaps To Address`
  h2 for legacy outputs. Response now `{markdown, refineNotes, quotaRemaining}`.
- `callGenerateCv` api-client returns `{markdown, refineNotes}`. Three
  call sites (results-section, refine-tools-block, refined-cv-mode-banner)
  store both into `analysis-store` (which gains `refineNotes: string | null`).
- `refined-cv-view.tsx` renders the CV in its existing Card, then refine
  notes as a separate primary-bordered Card labelled "Refine notes · Chỉ
  cho bạn — KHÔNG nằm trong CV gửi recruiter".
- `download-actions.tsx` untouched — it only reads `matchedCv`, which is
  now CV-only after the split, so `.md` downloads are clean.

### Admin usage row ordering (commit `5023348`)

Visit history and Daily volume tables on `/admin/usage` rendered
oldest-first because the underlying arrays are built that way for
cumulative math. Wrapped each `.map` in `[...arr].reverse().map(...)` so
today's row sits at the top. Totals (which use the original array order
via `.reduce`) unaffected.

### Ingest taxonomy Phase 1 (commits `8e2a710`, `da3578c`)

User flagged the architectural rule: "filter BEFORE scrape, never broad-
scrape-then-reclassify; cover all 6 verticals; bilingual VN + EN; research-
driven." Memory `feedback-filter-before-scrape` captures the rule.

Five sibling researcher agents produced taxonomy md files for tech,
marketing, finance, sales, ops, other (each 450-825 lines covering
sub-domains, bilingual title patterns, confirming keywords, source slug
maps, and negative-filter rules). A planner synthesised the master plan
+ 5 phase files at `plans/260603-1655-ingest-taxonomy/`.

Code shipped this evening (Phase 1 of 5):

- `src/lib/jobs/taxonomy.ts` (~330 lines) — single source of truth.
  `TAXONOMY` constant: 6 verticals × 47 sub-domains. Each sub-domain
  carries (id, vertical, titlesPositive regex, sourceSlugs per board).
  Each vertical carries a titlesNegative regex evaluated BEFORE the
  positive list. Exposes `classifyTitle(vertical, title)`,
  `pickSubVertical(title)`, `slugToVerticalAndSub(source, slug)`.
- `src/lib/jobs/types.ts` — `subVertical?: string` added to `Job` and
  `JobInput`. Optional so 150 live prod records read fine with the new
  shape; new ingests carry it from the filter step.
- `tests/taxonomy.test.ts` — 56 assertions: slug coverage per vertical,
  30 positive-title fixtures (Senior Backend Nodejs, Data Engineer, ML
  Engineer, DBA, Kế Toán Tổng Hợp, Môi Giới BĐS, Bác Sĩ, Kỹ Sư Cơ Khí, …),
  12 negative rejections, 4 cross-vertical routing checks (Sales Engineer
  → sales not tech, Insurance Sales → sales not finance, Kỹ Sư Cơ Khí →
  other not tech, clean Data Engineer → tech.data).

Regex gotcha solved during test bring-up: Node V24's `\b` doesn't fire
on Vietnamese diacritic boundaries even with the `u` flag. Stripped all
`\b` from the taxonomy regexes and rely on substring matching within
parenthesised alternations — false-positive risk on short keywords kept
under control by alternation context.

Phases 2-5 (vl24h pre-filter rewrite → multi-board topcv+vnw → re-ingest
→ weekly cron + relax freshness ≤7d) deferred to next session. Total
remaining effort ≈ 12-17h.

### Dashboard landing page (commit `4daec0a`)

`/` (root) used to render the Analyze form directly. Now serves a
Dashboard with the project tagline as the first-impression hero:

> AI giúp bạn **chọn đúng job**, **sửa đúng CV**, **biết gap thật**, và
> tăng xác suất được gọi phỏng vấn. Còn lại **vẫn là khả năng của bạn**.

Hero uses a gradient + radial-blob background, the four action verbs
highlighted in the tertiary-container token, the closing phrase set
apart in bold with a 4px underline so the personal-accountability
message lands. Primary CTA is a large "Start Analyze →" button routing
to /analyze. Below the hero: a 4-card grid pairing each verb with a
one-line explanation of the feature that delivers it (tier system,
refine mode, red flags split, cover letter + roadmap). Secondary CTA
at the bottom.

Routing:
- `/(app)/page.tsx` renders `<DashboardPage />`
- new `/(app)/analyze/page.tsx` renders `<AnalyzePage />`
- sidebar gains a top "Dashboard" item; "Analyze" now points `/analyze`
- empty-state CTAs in career-path, job-fit, refined-cv updated `/` → `/analyze`

Backward compat: existing bookmarks of `/` land on Dashboard and one
click reaches Analyze. `sessionStorage` keys/serialization unchanged.

## Wave A — 2026-06-03 (Fit Tier UX overhaul, all phases EOD)

Plan `260603-1359-wave-a-fit-tier` (5 phases, est. 19-29h) shipped in one
session. Adds tier classification across recommend → refine → roadmap flow;
surfaces honest red-flag warnings; introduces cover-letter endpoint (7th cost
bucket).

### Fit-tier system (Phase 1-2)

- **`src/lib/jobs/fit-tier.ts`** — pure server logic: `TierLetter` (S/A/B/C/D/E),
  `tierFromScore()` (cliffs at 95/85/75/65/55), `QUOTA = {S:1, A:3, B:2, C:2,
  D:1, E:1}` (max 10), `enforceQuota()` (caps per tier, never cross-fills).
- **`src/lib/llm/prompt-job-recommend.ts`** — system prompt now asks for 10-15
  jobs across full 0-100 score range, max 3 study topics per job, anti-cluster
  instruction ("KHÔNG dồn cụm 80-85"). Drops the legacy `>80` filter.
  Includes a worked-example block (12-candidate fintech pool, ~11 distinct
  scores from 35 → 96) to hedge Gemini's known clustering bias around 80-85.
- **`src/lib/llm/normalize-job-recommend.ts`** — derives `tier` server-side from
  `overallScore`, sorts desc, calls `enforceQuota` before return. Loosens
  `studyTopics.min` from 3 → 1 (low-tier jobs naturally emit fewer). Adds
  `description` to `JobMatchOut` so refine-from-job runs without re-fetch.
- **`<TierBadge>`** atom (`src/components/ui/tier-badge.tsx`) — letter chip
  with semantic tooltip (`title=` attribute) + per-tier color map.
- **`<RedFlagsSection>`** (`src/features/analyze/red-flags-section.tsx`) — inline
  section under analyze tabs when `result.redFlags.length > 0`.
- **`<RedFlagsBanner>`** (`src/features/refined-cv/red-flags-banner.tsx`) —
  collapsible amber banner top of /refined-cv.
- **Job-fit list page** — groups by tier (S→E) with icon + count headings;
  underfill footer "Chỉ N/10 jobs match. Thêm jobs ngày mai" when `<10`.
- **SessionStorage cache** `job-fit-matches:v1 → v2` (pre-tier caches lacked
  the new field; v2 invalidation prevents Phase 2 undefined crashes).

### Action column (Phase 3)

- **`<ActionButton>`** (`src/features/job-fit/action-button.tsx`) — per-tier
  CTA: S/A → `/refined-cv?jobId&mode=apply` (primary); B → `mode=fill-gaps`;
  C → `mode=stretch` (secondary intent); D/E → `/career-path?target&skillGaps`.
- **`detail-actions-bar.tsx`** refactored — takes `job: JobMatchOut`, hides
  "Mở trên source" link for tier D/E (low-fit → not pushing user to source).
- **`GenerateCvBody.inputs.mode`** added to schema + `prompt-generate-cv.ts`
  appends a `=== MODE ===` block with apply/fill-gaps/stretch instructions
  (read AFTER the HARD RULES so it never overrides "DO NOT invent").
- **`<RefinedCvModeBanner>`** (`src/features/refined-cv/refined-cv-mode-banner.tsx`)
  — client island, reads `?jobId&mode` via `useSearchParams`, looks up job in
  `useJobFit` store, synthesizes `analysisSummary` from `matchReasons +
  studyTopics`, click-to-generate (no auto-fire — same cost-discipline as
  cover letter; user explicitly confirms).
- **`career-path-page.tsx`** — reads `?target&skillGaps`, seeds `targetRole`,
  selects suggestion, appends gap list into `notes`. Route wrapped in
  `<Suspense>` for `useSearchParams` compliance.

### Cover Letter endpoint (Phase 4)

- **`POST /api/generate-cover-letter`** — mirrors `generate-cv` exactly:
  zod-validated body, `resolveApiKey` with action `'generate-cover-letter'`,
  kill-switch gate (shared key only), `callLLM`, `logLlmCall`, `recordCost`
  gated `!byok`. BYOK + admin bypass identical to other LLM routes.
- **System prompt** — 3-paragraph structure (hook → evidence → close), 250-400
  word target, no fabrication, no generic phrases ("passionate" / "team
  player"), no `Dear Hiring Manager` greeting (user adds manually).
- **Cost bucket** — 7th bucket `'generate-cover-letter'` added to
  `lib/cost/buckets.ts`. Same $1 WARN / $3 KILL thresholds (`cost/guard.ts`).
- **Quota** — `3/day` for logged-in users; `0` for anonymous (login-gate via
  resolveApiKey at line 62 returns 401 before quota path).
- **Admin usage** — `DailyGlobalRow` adds `generateCoverLetterOk/Error`;
  `/admin/usage` daily table adds "Cover Ltr ok / err" column.
- **`<CoverLetterBlock>`** (`src/features/refined-cv/cover-letter-block.tsx`)
  — replaces `cover-letter-stub.tsx` (deleted); reads `?jobId` for context,
  click-to-generate, renders `MarkdownView`, shows remaining quota.

### Verification

- `npx tsc --noEmit` clean across all phases.
- `vitest`: 111 passed, 10 skipped, 0 failed (rewrote 2 normalize tests to
  reflect new tier+quota behavior).
- `next build`: clean, `/api/generate-cover-letter` ƒ-registered.
- Deferred (Phase 5 noted): auto-fire-on-arrival for mode banner (cost-guard
  headroom unproven); `/api/jobs/{id}` lookup endpoint (banner falls back to
  store-empty hint).

### Cross-plan

- `260603-1205-ui-polish/plan.md` updated with "Wave A handoff" section listing
  4 new components that need token-ification.

## v0.3.1 — 2026-06-02 evening (pilot lockdown + ops UX)

Post-ship session. Real prod KV seeded with 150 vl24h jobs; multiple
operational hardenings; admin UX polish ahead of opening shared key
to public users once usage analysis on the ultra-tier API key completes.

### Auth & cost lockdown

- **Anonymous shared-key removed** (`resolve-api-key.ts`): guests now get 401
  `auth_required` instead of consuming the shared `GEMINI_API_KEY` with the
  IP-based stricter quota. Anyone reaching the LLM must either log in via
  Google or paste their own key via BYOK Settings drawer.
- **Email-based admin allowlist** (`ADMIN_USER_EMAILS` env): added alongside
  the existing `ADMIN_USER_IDS` (Google sub) check. Operators can promote a
  teammate by adding their gmail without first asking them to log in. New
  `isAdminUser(session.user)` aggregates both checks; six call sites
  migrated (admin/* layout, job-fit/* layout, refined-cv-page CTA gate,
  export-usage handler, recommend handler, app-shell sidebar flag).
- **Three-layer admin bypass**:
  1. `DISABLE_SHARED_KEY=1` env — admin keeps shared-key path (resolveApiKey
     skips the env check when caller is admin).
  2. `kill-switch:*` KV flags — admin skips the per-bucket cost gate in all
     four LLM routes (`analyze`, `generate-cv`, `career-path`, `job-recommend`).
  3. Maintenance flag — proxy.ts decodes the NextAuth JWT cookie and lets
     admins through the 503 page.
- **Public login gated** by `login:enabled` KV flag (fail-CLOSED):
  `/sign-in` returns 404 when off; topnav login button hidden; guests have
  no UI path to OAuth. Admin sessions bypass.
- **Site-wide maintenance toggle** via `maintenance:mode` KV flag — proxy.ts
  returns 503 + Vietnamese maintenance HTML on every page navigation.
  Admin bypasses via JWT.

### Operator surfaces

- **Admin UI**: `/admin/maintenance` rebranded to "Site Controls"; toggles
  for both maintenance and public login. Bypass-aware so admin never locks
  themselves out.
- **CLI scripts** (read `.env.local`):
  - `pnpm run kill-switch status | on <bucket> | off <bucket> | --all`
  - `pnpm run maintenance status | on | off`
  - `pnpm run login-flag status | on | off`
- **Diagnostic endpoint**: `GET /api/whoami` returns the caller's session
  shape + admin status. Non-admin response redacts env hints; admin
  response includes `adminEmailsLower` for misconfig debugging.

### Latency & quality

- **Job Fit recommend pipeline**:
  - `topKCandidates` cut from K=20 → K=10 (~50% LLM time saving).
  - Prompt asks 3-5 jobs × 3-5 study topics (was 5-10 × 5-10).
  - `callRecommendLlm` bumps `maxOutputTokens` 10K/12K → 16K/24K + extracts
    Gemini `finishReason`. Errors now classify into `MAX_TOKENS`, `SAFETY`,
    or generic with raw output excerpt for admin debugging.
  - Internal deadline at `maxDuration - 5s` propagates an AbortSignal
    through `embedText`, `callGemini`, `callLLM` — Vercel no longer kills
    the function before our catch returns a structured error.
- **Job Fit list page**: removed mount-time auto-refetch that burned a
  Gemini call on every revisit after the 6h cache expired. Now requires
  an explicit "Tìm job phù hợp" click; cached results render instantly.
- **User-facing errors**: list page no longer leaks Gemini/JSON/token
  wording — shows "Đề xuất job thất bại — Hệ thống đang gặp sự cố. Vui
  lòng thử lại sau." regardless of underlying cause. Admins still get the
  full code + detail in the network response.

### Embedding & job data

- **Gemini API migration**: `text-embedding-004` deprecation broke
  `/api/jobs/recommend` in prod (500 from embedContent 404). Swapped to
  `gemini-embedding-001` with `outputDimensionality: 768` + manual L2
  normalization at `embedText` return (model output is not unit-length
  when dimensionality is truncated; `cosineSim` assumes L2-normalized).
  One-shot migration `scripts/normalize-stored-embeddings.ts` re-normalized
  the 150 existing stored vectors (avg prior L2 = 0.59).
- **Latent KV bug fixed**: `loadBlobChunks` did `JSON.parse(idsRaw)` on
  what TS believed was a string, but Upstash REST auto-parses
  JSON-stringified values on `get` — the array came back already parsed,
  so JSON.parse threw SyntaxError. Surfaced for the first time today
  when the embeddings blob was populated in prod.
- **vieclam24h.vn scraper**: TopCV/ITviec/JobsGO are Cloudflare-blocked
  at the TLS-fingerprint layer; vl24h returns 200 with Schema.org
  JobPosting ld+json on detail pages. New `scripts/scrape-vl24h.ts` +
  parser library yields 150 real Vietnamese jobs across 6 verticals
  (25 each: tech, marketing, finance, sales, ops, other).
- **Vertical taxonomy**: extended `Job.source` enum with `'vl24h'`;
  `classifySeniority` learned Vietnamese patterns (`trưởng phòng/nhóm/ban`,
  `giám đốc`, `cao cấp`). Migration `scripts/backfill-vl24h-source.ts`
  retagged the 150 existing rows and re-classified seniority — 3 jobs
  bumped from `mid` to `lead` post-patterns.

### UI polish

- **Sidebar flattened**: dropped Start/Outputs/Archive/Admin group headings;
  flat list in workflow order (Analyze → Refined CV → Career Path → History
  → admin-only items). Admin-only is now a per-item `adminOnly` flag.
- **Job Fit & Study moved to admin-only** during the v0.3 KV-seed pilot;
  hidden from non-admin sidebar + CTA + page route + handler.
- **Refined CV** added to sidebar (was reachable only from Analyze results).
- **Empty-state CTAs** for Refined CV / Career Path / Job Fit all point
  back to `/` (Analyze) instead of hopping through each other — flatter,
  less circular flow.
- **Optimizations entry** removed from sidebar (page is a Phase-2
  placeholder; real optimization features are tabs inside Analyze results).
- **Interview Questions** tab dropped from results — it rendered a stub.
- **Reset to AI scores** button now shows a 1.5s "✓ Đã reset về điểm AI"
  confirmation flash so users perceive the click even when their slider
  values already matched the AI scores (the no-op case that previously
  read as broken).
- **Logout button** hidden for guests (used to render unconditionally and
  send unauthed users into a confusing signout flow).

### Files added (selected)

- `scripts/scrape-vl24h.ts`, `scripts/cost-kill-switch.ts`,
  `scripts/maintenance-mode.ts`, `scripts/login-flag.ts`,
  `scripts/normalize-stored-embeddings.ts`, `scripts/backfill-vl24h-source.ts`
- `src/lib/scrape/vl24h-parser.ts`, `src/lib/maintenance/maintenance-mode.ts`,
  `src/lib/maintenance/login-flag.ts`, `src/lib/jobs/classify-cv-vertical.ts`,
  `src/lib/jobs/vertical-index.ts`
- `src/app/api/whoami/route.ts`, `src/app/api/admin/maintenance/route.ts`,
  `src/app/api/admin/login-flag/route.ts`,
  `src/app/(app)/admin/maintenance/page.tsx` (+ toggle components),
  `src/app/(app)/job-fit/layout.tsx`

### Open follow-ups

- Pre-filter recommend candidates by CV vertical (using
  `classifyCvVertical` + `vertical-index`) — library code written this
  session, not yet wired into the route. Would tighten match quality and
  shave another ~30-50% off LLM time if candidates drop to 5 from a denser
  same-vertical pool.
- Hybrid refresh cron with top-up scraping (deferred to
  `plans/260602-1739-hybrid-refresh-topup/`).
- `consumeQuotaForAnon` is dead code in the resolver path; remove in a
  cleanup commit.

---

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

