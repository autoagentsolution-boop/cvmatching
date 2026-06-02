---
type: spec
date: 2026-05-29
time: 10:31
slug: job-fit-study
status: plan-ready
project: ResumeRefine / CVMatching v0.3
supersedes: plans/reports/brainstorm-260528-1854-job-match-self-quiz.md
related:
  - plans/260528-1030-career-path-feature/plan.md
  - docs/project-changelog.md
---

# Spec — v0.3 Job Fit & Study

Final architecture sau brainstorm 2 buổi (260528 + 260529). Quiz feature đã drop hoàn toàn. Output = curated study topics per recommended job, không có interactive quiz/MC.

## Goal

Sau khi user xong `/refined-cv`, đề xuất 5-10 job VN khớp >80 + danh sách 5-10 chủ đề cần ôn cho từng job (with rationale + estimated hours). Track engagement qua redirect proxy khi user apply external.

Mục tiêu: tăng engagement post-refined-cv, tạo learning path cụ thể, đo signal trước khi đầu tư scraper v0.3b.

## User journey

```
refined-cv  →  CTA "Tìm 10 job phù hợp + chủ đề ôn luyện →"
            →  /job-fit
                empty state: paste CV
                job card list (5-10):
                  title @ company · seniority · location · score
                  matchReasons (3 bullets)
                  top 3 studyTopics inline
                  "Xem chi tiết →" /job-fit/[jobId]
            →  /job-fit/[jobId]
                full 9-dim scores (read-only sliders)
                full matchReasons
                full studyTopics list:
                  name · tier badge · estimatedHours
                  whyForThisJob (1-2 câu JD-specific)
                  dislike button
                "Cập nhật: X ngày trước" badge
                "Apply trên {source} →" → /api/r/[jobId] redirect
                "Quay lại danh sách"
```

Sidebar: thêm mục `Job Fit & Study` (chronological position sau Career Path).

## Architecture

### Single-call recommendation pipeline

```
POST /api/jobs/recommend
  In: { cvText }
  
  1. HMAC-SHA-256(cvText, EMBED_CACHE_SECRET) → cache lookup KV (TTL 6h)
  2. Cache miss → Gemini text-embedding-004(cvText) → cache
  3. Load embeddings:active:v<n> chunked blob (module memory cached)
  4. Cosine similarity → top 20 candidates
  5. Single LLM call (Gemini Flash, ~10K max_output_tokens):
       system: VN job market expert + output JSON schema
       input: { cv, candidates: [{id, title, company, vertical, description}] }
       output: { jobs: [{
         jobId,
         overallScore: 0-100,
         dimensionScores: { ... 9 dims ... },
         matchReasons: string[3-5],
         studyTopics: [{
           name,                  // "React Hook Patterns"
           category,              // 'frontend'|'backend'|'db'|'devops'|'soft'|'domain'
           tier,                  // 'basic'|'intermediate'|'advanced'
           whyForThisJob,         // 1-2 sentences specific to JD
           estimatedHours         // "4-8h"
         }] (5-10 per job)
       }] }
  6. Filter overallScore > 80, top 5-10
  7. Record metrics:cost:<YMD> += estimated cost
  
  Out: { jobs, fromCache: false, expiresAt }
```

**No** separate taxonomy, **no** quiz endpoint, **no** topic-custom endpoint. LLM batch native handles all verticals (IT + non-IT) via context.

### Ingest pipeline

```
scripts/ingest-jobs.ts CLI

Commands:
  npm run ingest paste                 # interactive single-job paste
  npm run ingest file <path>           # batch JSON import w/ dedup by sourceUrl
  npm run ingest stats                 # count by vertical/seniority/expired
  npm run ingest expire                # mark verifiedAt > 21d as expired
  npm run ingest rebuild-embeddings    # rebuild chunked blob embeddings:active:v<n>

Inputs auto-detect + confirm:
  title, vertical (heuristic from company industry), seniority (regex from title)

Saves:
  job:<id> → { ..., embedding: base64(Float32Array) }
  jobs:active → set of active ids
  jobs:expired → set of expired ids
  embeddings:active:v<n> → packed blob (chunked if > 250 jobs)
```

### Refresh pipeline

```
GET /api/jobs/refresh (Vercel Cron 1×/day, ~3am ICT)
  For each job in jobs:active:
    1. HEAD sourceUrl (fallback GET if 405)
    2. Status 404/410/redirect-to-list → move to expired
    3. Status 200 + heuristic "Job expired" text → expired
    4. Status 200 + body contains title match → update verifiedAt
    5. Sleep 2000ms + jitter ±500ms between requests
  Auto-expire: verifiedAt > 21 days
  Log: metrics:refresh:<YMD> = { ok, expired, errors }
  Send alert if active pool < 50
```

### Redirect tracking

```
GET /api/r/[jobId]
  1. Fetch job:<id>, validate exists
  2. Increment metrics:click:<jobId>:<YMD>
  3. Increment metrics:click:total:<YMD>
  4. 302 redirect to job.sourceUrl
  5. Set Cache-Control: no-store

UI uses /api/r/<jobId> instead of direct sourceUrl
```

### Feedback

```
POST /api/topics/feedback
  In: { jobId, topicId, action: 'dislike' }
  // NO reason field — privacy concern
  Stores: lpush topic-feedback:<topicId> { jobId, ts }
          incr dislikes:<topicId>:<weekYMD>
```

## Data model

```ts
// lib/jobs/types.ts
type Vertical = 'tech' | 'finance' | 'marketing' | 'sales' | 'ops' | 'hr' | 'other';
type Seniority = 'intern' | 'junior' | 'mid' | 'senior' | 'lead';
type Tier = 'basic' | 'intermediate' | 'advanced';

type Job = {
  id: string;              // sha256(sourceUrl).slice(0,16)
  title: string;
  company: string;
  vertical: Vertical;
  seniority: Seniority;
  description: string;     // raw paste
  sourceUrl: string;
  source: 'itviec' | 'topcv' | 'vnw' | 'manual';
  location: string;        // 'HCM' | 'HN' | 'DN' | 'remote' | etc
  postedAt?: string;       // ISO
  verifiedAt: string;      // ISO
  embedding: string;       // base64 Float32Array (768 dim, Gemini text-embedding-004)
};

type StudyTopic = {
  name: string;
  category: 'frontend' | 'backend' | 'db' | 'devops' | 'soft' | 'domain';
  tier: Tier;
  whyForThisJob: string;
  estimatedHours: string;  // "4-8h"
};

type JobMatch = {
  jobId: string;
  overallScore: number;
  dimensionScores: Record<string, number>;  // 9 dims
  matchReasons: string[];
  studyTopics: StudyTopic[];
};
```

## Files

**New:**
- `cv-ex-refactor/src/lib/jobs/types.ts`
- `cv-ex-refactor/src/lib/jobs/repo.ts`         — KV CRUD, chunked embed blob
- `cv-ex-refactor/src/lib/jobs/score.ts`        — cosine sim + LLM batch prompt
- `cv-ex-refactor/src/lib/jobs/embed.ts`        — Gemini embedding wrapper + HMAC cache
- `cv-ex-refactor/src/lib/jobs/classify.ts`     — heuristic vertical/seniority detection
- `cv-ex-refactor/src/lib/cost/guard.ts`        — metrics + kill-switch
- `cv-ex-refactor/src/app/api/jobs/recommend/route.ts`
- `cv-ex-refactor/src/app/api/jobs/refresh/route.ts`
- `cv-ex-refactor/src/app/api/topics/feedback/route.ts`
- `cv-ex-refactor/src/app/api/r/[jobId]/route.ts`
- `cv-ex-refactor/src/app/(app)/job-fit/page.tsx`
- `cv-ex-refactor/src/app/(app)/job-fit/[jobId]/page.tsx`
- `cv-ex-refactor/src/components/job-card.tsx`
- `cv-ex-refactor/src/components/job-detail.tsx`
- `cv-ex-refactor/src/components/topic-chip.tsx`
- `cv-ex-refactor/scripts/ingest-jobs.ts`
- `cv-ex-refactor/data/seed-jobs.json`

**Modified:**
- `cv-ex-refactor/src/lib/quota/buckets.ts`     — add `job-recommend` only
- `cv-ex-refactor/src/app/(app)/refined-cv/page.tsx` — CTA "Tìm 10 job phù hợp + chủ đề ôn luyện →"
- `cv-ex-refactor/src/components/sidebar.tsx`   — nav "Job Fit & Study"
- `cv-ex-refactor/src/middleware.ts` (proxy)    — exclude /api/jobs, /api/topics, /api/r
- `cv-ex-refactor/src/app/api/admin/usage/route.ts` — surface job-recommend metrics + cost
- `cv-ex-refactor/vercel.json`                  — cron schedule
- `cv-ex-refactor/docs/deployment.md`           — env, cron, ingest CLI runbook
- `cv-ex-refactor/docs/privacy.md`              — CV embedding cache, JD-to-LLM disclosure

## Constraints

| Hạng mục | Quyết định |
|---|---|
| Seed scope | 150 jobs: 80 tech + 30 marketing + 20 finance + 20 sales/ops |
| Sourcing | Manual paste via CLI ingest tool (no playwright v0.3a) |
| Embedding | Gemini text-embedding-004 (free 1500/day, server-side only) |
| LLM provider | Gemini Flash (single batch call) |
| Storage | Upstash KV, chunked blob `embeddings:active:v<n>` (250 jobs/chunk) |
| Persistence (client) | sessionStorage only — no auth, no DB |
| Resource links per topic | DEFER to v0.3.5 (hallucination risk + ship faster) |
| Job detail route | Separate route `/job-fit/[jobId]` (shareable URL) |
| External click tracking | Redirect proxy `/api/r/[jobId]` (302 + KV metric) |
| Vertical handling | LLM batch native (no fixed taxonomy, no JIT extract endpoint) |
| Quota anon | 5 recommend/day |
| Quota user | 12 recommend/day |
| Quota BYOK | unlimited (existing pattern, cost-on-user) |
| Cost ceiling | $1/day @ 200 users (target), $3/day kill-switch |

## Phase 0 — Hardening (ship trước feature work)

1. **Set `ADMIN_USER_IDS` prod + verify admin gate** (Severity High — gate có thể leak nếu env miss)
2. `EMBED_CACHE_SECRET` env + HMAC-SHA-256 cache keys (prevent cache-key prediction)
3. Module cache rule audit: chỉ `embeddings:active:*` được cache memory; CV-derived = KV-only TTL 6h
4. `topic-feedback` schema: drop `reason` free-text field
5. Cron refresh: rate limit 1 req/2s, identify User-Agent, jitter ±500ms
6. `middleware.ts` matcher: exclude `/api/jobs`, `/api/topics`, `/api/r` from visit counter
7. Cost guard:
   - `metrics:cost:<YMD>` per-endpoint accumulator
   - `kill-switch:<bucket>` per-bucket flags
   - Cron 5-min check → POST `ALERT_WEBHOOK_URL` + activate flag if > $3
   - Endpoint guard middleware checks flag before serve
8. Ingest CLI: `.env.local` setup + README warn + `.gitignore` confirm
9. `docs/privacy.md`: document CV embedding cache, JD-to-LLM, vertical classifier, redirect tracking

## Phase split (estimated)

| Phase | Scope | Duration |
|---|---|---|
| 0 | Hardening 9 items | 1-1.5 day |
| 1 | Ingest CLI + 150 seed jobs + embedding blob | 1.5-2 day |
| 2 | `/api/jobs/recommend` endpoint + LLM batch prompt + score lib | 1.5 day |
| 3 | UI `/job-fit` list + `/job-fit/[jobId]` detail + sidebar nav | 1.5-2 day |
| 4 | Refresh cron + redirect tracking + feedback endpoint + cost guard wiring + admin surface | 1 day |
| 5 | Testing + privacy.md + deployment.md + smoke deploy | 0.5 day |
| **Total** | | **7-8 days** |

## Quota & cost

```ts
// lib/quota/buckets.ts (modified)
export const BUCKETS = {
  ...existing,
  'job-recommend': { anon: 5, user: 12 }
} as const;
```

Cost math at 200 users/day, 3 calls/user:
- 600 LLM batch × $0.0014 = **$0.84/day**
- Embedding: free tier (200 cv embed/day < 1500/day limit)
- KV ops: well within Upstash free tier
- Cron: 1×/day, ~150 outbound HEAD requests = negligible

Kill-switch threshold: $3/day (3.5× headroom for abuse).

## Success metrics (v0.3a, 2 weeks post-ship)

- Activation: % refined-cv → click "Tìm job" CTA ≥ **30%**
- Engagement: % user expand ≥ 1 job detail ≥ **40%**
- Topic quality: dislike rate per topic < **15%**
- CTR: % user click "Apply trên {source}" ≥ **15%**
- Cost ceiling: < $1/day @ 200 users

## Risks

| Risk | Mitigation |
|---|---|
| LLM batch hallucinate generic studyTopics | Strict JSON schema + topic dislike feedback loop để tune prompt v0.3.1 |
| User feel topic chỉ là plain string, low value | `whyForThisJob` + `estimatedHours` per topic; defer resource links to v0.3.5 nếu signal yếu |
| 10K output tokens vượt limit | Request `maxOutputTokens` rõ ràng; fallback giảm 10 → 5 jobs nếu LLM throws |
| Job pool stale | 21-day TTL + cron refresh + manual reseed runbook |
| KV > 500 jobs | JobRepo abstract → swap Neon nhanh |
| Embedding inversion attack on cached CV | HMAC cache key + TTL 6h + KV-only (not module memory) |
| ToS pushback from ITviec/TopCV | Seed phase = manual paste = grey but defensible; document attribution + takedown channel in `docs/privacy.md` |
| `ADMIN_USER_IDS` unset → admin dashboard open | Phase 0 item #1 — block ship if env missing |

## Out of scope (defer)

- **v0.3b**: live cron-scrape pipeline (ITviec/TopCV/VNW scrapers)
- **v0.3.5**: resource links per study topic; non-IT taxonomy expansion if signal good
- **v0.4**: persistent progress + auth; LLM grade quiz (if reintroduced); job alert email; custom topic CRUD

## Open questions

None. All decisions locked.
