# System Architecture — ResumeRefine / CVMatching

## Overview

ResumeRefine is a Next.js application deployed on Vercel with Upstash KV backend. Architecture separates concerns across CV analysis, career guidance, and job recommendations — each with distinct LLM providers, quota buckets, and privacy boundaries.

---

## Core subsystems

### 1. CV Analysis & Rewrite (v0.1–v0.3)

**Scope:** Analyze CV against JD; generate optimized resume narrative.

**Data flow:**
```
User CV + JD (client paste)
  → POST /api/analyze (Gemini text-embedding-004 embed)
  → CV cached 6h (HMAC key, no PII stored)
  → LLM batch: 9-dim score + match reasons
  → Frontend renders slider UI (user can drag to recompute)
  → POST /api/cv/rewrite (career narrative generation)
  → sessionStorage (no persistence)
```

**Key files:**
- `src/lib/llm/analyze-prompt.ts` — analysis schema + scoring dimensions
- `src/lib/quota/gate.ts` — per-bucket rate limiting
- `src/app/api/analyze/route.ts` — main endpoint
- `src/features/analysis/hooks/use-analysis.ts` — Zustand store + sessionStorage persist

**Privacy:** CV text stays client-side; only embedding vectors + scores sent to KV. BYOK vault option available (Settings).

---

### 2. Career Path & Roadmap (v0.2)

**Scope:** Auto-suggest career trajectories; generate 3-6 milestone roadmaps with skill gaps.

**Data flow:**
```
Refined CV + optional aspiration
  → POST /api/career-path/suggest (LLM infers 3-5 paths: specialist, leadership, pivot, breadth)
  → User picks one aspiration
  → POST /api/career-path (LLM generates roadmap: milestones, gaps, 30/60/90-day quick wins)
  → sessionStorage (cached by first 200 chars CV hash to avoid redundant calls)
```

**Key files:**
- `src/lib/llm/prompt-career-path.ts` — roadmap schema + feasibility check
- `src/lib/careers/normalize-*.ts` — LLM output parsing
- `src/features/career-path/store.ts` — Zustand with sessionStorage
- `src/app/api/career-path/route.ts` + `suggest/route.ts`

**Quota:** Separate `career-path` (2-3/day) and `career-path-suggest` (10/min IP rate-limit, no debit).

**Privacy:** Aspiration text never stored; cache key is hash, not content.

---

### 3. Job Fit & Study (v0.3)

**Scope:** Recommend 5-10 jobs matching CV; surface 5-10 study topics per job (9-dim scores, reason, estimated hours).

#### Architecture overview

```
User inputs: CV text (from /refined-cv or /job-fit paste)
│
├─ Embed CV
│  ├─ Lookup: KV key = HMAC-SHA256(cvText, EMBED_CACHE_SECRET)
│  ├─ Cache hit (6h TTL) → return cached Float32Array(768)
│  └─ Cache miss → call Gemini text-embedding-004 → store base64 in KV
│
├─ Load job corpus
│  ├─ Fetch embeddings:active:v<n> chunked blob (250 jobs per chunk)
│  └─ Module memory cache (immutable after boot)
│
├─ Score top-K candidates
│  ├─ Cosine similarity: dot(cvEmbed, jobEmbed) / (norm(cvEmbed) * norm(jobEmbed))
│  ├─ Filter: top 20 by similarity score
│  └─ Extract fields: {jobId, title, company, vertical, description}
│
├─ LLM batch call
│  ├─ Provider: Gemini Flash (single call, ~10K max output tokens)
│  ├─ System prompt: VN job market expert + JSON schema + 9-dim rubric
│  ├─ Input: { cv, candidates: [...top 20 jobs...] }
│  └─ Output: { jobs: [{ jobId, overallScore 0-100, dimensionScores: {...9}, matchReasons: [...], studyTopics: [...] }] }
│
├─ Filter & normalize
│  ├─ Drop scores ≤ 80
│  ├─ Keep top 5-10 by overall score
│  ├─ Validate: all 9 dims present, studyTopics array non-empty
│  └─ Enrich: add job metadata (postedAt, verifiedAt, sourceUrl)
│
├─ Record metrics
│  ├─ `metrics:cost:<YMD>:job-recommend` += estimated Gemini cost
│  ├─ Fire alert if daily cumulative > $1 (warn) or > $3 (kill-switch)
│  └─ Check kill-switch flag before returning response
│
└─ Return to client
   ├─ { jobs: [...], fromCache: boolean, expiresAt: ISO }
   └─ sessionStorage (no persistence)
```

#### Key components

**Embedding & cache (`src/lib/jobs/embed.ts`):**
- `getOrEmbedCV(cvText)` — returns cached embedding or calls Gemini
- HMAC-SHA256 key derivation (deterministic, no PII leakage)
- TTL 6h; quarterly rotation of `EMBED_CACHE_SECRET` auto-invalidates old entries

**Scoring (`src/lib/jobs/score.ts`):**
- `cosineSim(vec1, vec2)` — normalized dot product [0, 1] range
- `recommendJobs(cvEmbed, candidates)` — top-K candidates, filter low scores
- LLM batch prompt (VN context, strict JSON schema, 9-dim rubric)

**Repository (`src/lib/jobs/repo.ts`):**
- KV CRUD: `getJob(jobId)`, `listActive()`, `expireJob(jobId)`, `touchVerifiedAt(jobId)`
- Chunked blob packing: `packEmbeddings(jobs)`, `unpackEmbeddings(blob)`
- Job fixtures + type safety (Zod schemas)

**Classification (`src/lib/jobs/classify.ts`):**
- `classifyVertical(title, company)` — regex heuristic → tech|finance|marketing|...
- `classifySeniority(title)` — regex → intern|junior|mid|senior|lead
- No LLM calls; 100% server-side

**Cost guard (`src/lib/cost/guard.ts`):**
- Per-bucket daily spend tracking in KV
- Alert webhook (Slack/Discord) at thresholds
- Kill-switch flag blocks endpoint at $3/day

#### KV keyspace

| Key pattern | Value | TTL | Purpose |
|---|---|---|---|
| `job:<jobId>` | full job record (JSON) | 21d | Job storage |
| `jobs:active` | set of IDs | none | Active pool tracking |
| `jobs:expired` | set of IDs | none | Archive |
| `embeddings:active:v<n>` | packed blob (base64) | none | Corpus embeddings (module memory cached) |
| `embed-cache:<hmac>` | base64 Float32Array | 6h | CV embedding cache |
| `metrics:cost:<YMD>:job-recommend` | USD string | 90d | Daily spend per bucket |
| `metrics:click:<jobId>:<YMD>` | counter | 2d | Redirect clicks per job |
| `metrics:click:total:<YMD>` | counter | 2d | Total clicks today |
| `metrics:refresh:<YMD>` | stats JSON | 30d | Cron tick metrics |
| `refresh:cursor` | integer (0–N) | none | Resumable batch position |
| `kill-switch:job-recommend` | "true" | 24h | Cost guard flag |

#### Cron refresh pipeline

**Schedule:** `0 20 * * *` (20:00 UTC = 3am ICT, daily)

**Vercel tier:** Pro (`maxDuration: 300s`)

**Logic:**
```
GET /api/jobs/refresh (authorized with CRON_SECRET)
│
├─ Load cursor from KV (position in jobs:active)
├─ Batch HEAD/GET requests to job.sourceUrl (max ~150 jobs per tick)
│  ├─ If 404/410/redirect-to-list → expireJob(jobId)
│  ├─ If 200 + "Job expired" heuristic → expireJob(jobId)
│  ├─ If 200 + title match → touchVerifiedAt(jobId)
│  └─ Sleep 1500ms ± 500ms jitter between requests
├─ Auto-expire: jobs with verifiedAt > 21d → move to jobs:expired
├─ Record metrics:refresh:<YMD> = { ok, expired, errors }
├─ Check pool size: if < 50 → fire alert webhook
└─ Save updated cursor for next tick
```

**Constraints:**
- User-Agent: `ResumeRefineRefreshBot/1.0` (identify bot, avoid blocking)
- Hard deadline: 270s elapsed (30s buffer under 300s `maxDuration`)
- Cursor auto-wraps to 0 when all jobs processed

#### Redirect tracking (`GET /api/r/[jobId]`)

```
User clicks "Apply" → calls /api/r/<jobId>
│
├─ Fetch job:<jobId> (validate exists)
├─ Increment metrics:click:<jobId>:<YMD>
├─ Increment metrics:click:total:<YMD>
├─ 302 redirect to job.sourceUrl
└─ Set Cache-Control: no-store
```

**Privacy:** Only jobId + date stored (no IP, user-agent, user ID).

#### Topic feedback (`POST /api/topics/feedback`)

```
User clicks "Không thích" on study topic
│
└─ POST body: { jobId, topicId, action: 'dislike' }
   (schema: strict — no extra fields like reason)
   ├─ Increment dislikes:<topicId>:<weekYMD> counter
   ├─ LPUSH to topic-feedback:<topicId> list (max 1000, TTL 7d)
   └─ Return 204 No Content
```

**Privacy:** No free-text feedback stored (reason field rejected). Counter-only approach.

#### Ingest CLI (`npm run ingest`)

```
Interactive commands:
├─ paste        → single job paste (interactive prompt)
├─ file <path>  → batch JSON import
├─ stats        → display pool stats (count by vertical/seniority/expired)
├─ expire       → manual job expiry
└─ rebuild-embeddings → re-embed all active jobs (expensive, costs Gemini tokens)
```

**Workflow:**
- User pastes JD → auto-classify vertical + seniority (regex)
- Confirm or override classification
- Gemini embed → store in KV
- Dedup by sourceUrl
- 150-job seed dataset pre-embedded

#### UI pages

**`/job-fit` (list):**
- Empty state: paste CV or load from prior analysis
- Job card list (5-10): title @ company, seniority, location, score
- Inline top-3 study topics
- "View details →" link to `/job-fit/[jobId]`

**`/job-fit/[jobId]` (detail):**
- Full 9-dim scores (read-only sliders; user can drag to recompute overall score client-side)
- Full match reasons
- Complete study topics: name, tier badge, estimated hours, why-for-this-job
- Dislike button
- Updated timestamp ("3 ngày trước" badge)
- "Apply on {source} →" button (uses `/api/r/[jobId]` proxy)

**Sidebar nav:** New item "Job Fit & Study" (chronological position after Career Path)

---

### 4. Admin Dashboard (`/admin/usage`)

**Scope:** Monitor shared-key usage, quota, costs, top jobs, dislike trends.

**Access control:** `ADMIN_USER_IDS` env var (comma-separated email allowlist).

**Panels:**
1. **Shared-key usage:** Daily call count, token spend, USD cost. Alerts threshold.
2. **Quota breakdown:** Per-bucket calls (analyze, rewrite, career-path, job-recommend).
3. **Cost history:** 30-day chart, per-bucket drill-down.
4. **Job Fit metrics (v0.3+):**
   - Today's recommend cost + refresh stats
   - Top-10 clicked jobs (by jobId)
   - Top-disliked study topics (weekly)
5. **CSV export:** Download full usage table.

**KV keys read:**
- `metrics:cost:*` (per-bucket daily spend)
- `metrics:click:*` (job click counts)
- `metrics:refresh:*` (cron stats)
- `dislikes:*` (dislike counters)
- `quota:*` (quota consumption)

---

## Deployment & ops

### Environment variables

**Required (production):**
- `AUTH_SECRET` — BYOK vault encryption key derivation
- `GEMINI_API_KEY` — shared-key LLM provider
- `EMBED_CACHE_SECRET` — HMAC key for CV embedding cache (v0.3)
- `CRON_SECRET` — Vercel cron auth (auto-injected on Pro tier)
- `ADMIN_USER_IDS` — admin dashboard allowlist
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — auto-injected by Vercel KV

**Optional:**
- `OPENAI_API_KEY` — fallback LLM provider
- `ALERT_WEBHOOK_URL` — Slack/Discord for cost/pool warnings
- `ALERT_SHARED_DAILY_COST_USD` — alert threshold (default $2.50)
- `DISABLE_SHARED_KEY=1` — force BYOK-only mode (emergency)
- `CSP_REPORT_ONLY=1` — CSP report-only mode (staging)

### Rollback procedure

See `docs/deployment.md` §15 for per-phase rollback targets.

**Quick rollback (KV state persists):**
1. Vercel Dashboard → Deployments → select prior good commit
2. Click ⋯ → **Promote to Production**
3. Takes ~10s; KV data untouched

---

## Security & privacy

### Data residence

- **CV text:** Client-side only (sessionStorage, cleared on tab close)
- **CV embeddings:** KV (Upstash Redis, encrypted at rest, TTL 6h)
- **Job descriptions:** KV + module memory cache (no CV text stored)
- **User feedback:** KV counters only (no identifiers, no free-text)
- **Metrics:** KV (aggregated, TTL per metric type)

### Authentication & authorization

- **Sign-in:** Hidden in pilot; uses NextAuth (Google OAuth deferred to v0.4)
- **Admin dashboard:** `ADMIN_USER_IDS` env allowlist
- **Cron:** Bearer `CRON_SECRET` required
- **BYOK vault:** AES-GCM encrypted, httpOnly cookie, TTL 4h

### Rate limiting & quotas

- Per-bucket quota gates: `analyze`, `rewrite`, `career-path`, `job-recommend`
- Anonymous quota per IP (shared KV per-IP counter)
- BYOK path: unlimited (cost on user)
- IP-based `career-path-suggest` rate limit: 10/min (passthrough, no quota debit)

### CSP & hardening

- Content Security Policy: `strict-dynamic` + nonce-based script execution
- HSTS: 2 years (all subdomains)
- No inline scripts; all event handlers via React
- Nonce rotated per request

---

## Performance considerations

### Module memory caching

**Immutable (cached once at boot):**
- `embeddings:active:v<n>` chunked blob (250 jobs per chunk)
- Reason: embedding vectors are large (~768 floats each) and rarely change

**Mutable (always fetched from KV):**
- Individual job records (`job:<jobId>`)
- CV embedding cache (`embed-cache:<hmac>`) — TTL enforced server-side
- Metrics counters — fresh read for each request
- Reason: user input changes, metrics are transient

### LLM token budgeting

| Endpoint | Model | Max output | Typical | Notes |
|---|---|---|---|---|
| `/api/analyze` | Gemini Flash | 2048 | 400 | 9-dim scores + match reasons |
| `/api/cv/rewrite` | Gemini Flash | 4096 | 800 | Career narrative |
| `/api/career-path/suggest` | Gemini Flash | 4096 | 1500 | 3-5 trajectory options |
| `/api/career-path` | Gemini Flash | 24576 | 8000 | Full roadmap (milestones, gaps, alt paths) |
| `/api/jobs/recommend` | Gemini Flash | 10240 | 3500 | 5-10 jobs × 9 dims + study topics |

### Embedding model

- **Provider:** Google Gemini text-embedding-004
- **Dimension:** 768
- **Rate limit:** Free tier 1500 requests/day (sufficient for <500 daily users)
- **Cost:** Free tier (v0.3 target: embed <200 CVs/day << 1500 limit)

---

## Future architecture changes

### v0.4 persistence layer

- Add Neon Postgres for:
  - User profiles (OAuth)
  - Job application history (user_job_saves)
  - Custom topic CRUD (power-user)
- KV remains for real-time counters + caching

### v0.3.b live scraper

- Playwright-based job scrapers (iTViec, TopCV, VNW)
- Separate scheduled pipeline (not blocking recommend endpoint)
- Scraper output → ingest CLI
- No production activation until data quality validated

---

## Monitoring & alerts

### KV dashboard (Upstash console)
- Command count, hit rate, latency p95
- Free tier: ~30K commands/day limit

### Vercel logs
- Filter: `event:"llm_call"`, `event:"csp_violation"`, `[quota]`, `[ratelimit]`, `[alert-webhook]`
- Track: LLM errors, quota exceeds, cost spikes

### Alert webhook
- Fires on thresholds: `ALERT_SHARED_DAILY_COST_USD`, `ALERT_SHARED_DAILY_CALLS`
- Payload: timestamp, bucket, metric, threshold, current value
- Dedup: once per UTC day per threshold

---

## References

- **Privacy policy:** `docs/privacy.md`
- **Deployment runbook:** `docs/deployment.md`
- **Changelog:** `docs/project-changelog.md`
- **Roadmap:** `docs/development-roadmap.md`
- **Spec (v0.3):** `plans/reports/spec-260529-1031-job-fit-study.md`
