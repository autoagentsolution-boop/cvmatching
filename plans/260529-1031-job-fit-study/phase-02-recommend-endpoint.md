# Phase 02 — `/api/jobs/recommend` Endpoint + LLM Batch + Score Lib + HMAC Cache

## Context Links
- Spec: `plans/reports/spec-260529-1031-job-fit-study.md` (Single-call recommendation pipeline)
- Phase 0: HMAC secret + cost guard + quota bucket
- Phase 1: `lib/jobs/repo.ts`, `lib/jobs/pack-embeddings.ts`, `lib/jobs/embed.ts`, `lib/jobs/types.ts`
- LLM client reference: `cv-ex-refactor/src/lib/llm/call-gemini.ts`
- Career-path route reference: `cv-ex-refactor/src/app/api/career-path/route.ts` (quota + resolve key + log pattern)
- Humanize errors: `cv-ex-refactor/src/lib/llm/humanize-error.ts`

## Overview
- **Priority:** P1 — blocks Phase 3 UI
- **Status:** pending
- **Description:** The single endpoint that takes `{ cvText }`, returns 5-10 job matches with 9-dim scores, matchReasons, and 5-10 studyTopics each. One LLM call per request. CV embedding cached via HMAC for 6h.

## Key Insights
- **Single batch LLM call** — feed all 20 candidate jobs in one prompt, request JSON for the full match set. Saves 20× the latency and 20× the LLM cost vs per-job scoring.
- Embedding `embeddings:active:v<n>` blob is loaded into **module memory once** (Vercel function instance) — subsequent requests on the same instance hit RAM, not KV. Spec calls this "module memory cached" — only the embedding blob is allowed in memory; CV-derived data is KV-only with TTL.
- HMAC cache key (`embed-cache:hmac(cvText, EMBED_CACHE_SECRET)`) prevents an attacker from probing the cache by guessing CV text (raw-hash would let an attacker confirm presence by computing the same hash).
- Cosine sim on 150 vectors is ~110 KB of math — sub-1ms on Node.js with `Float32Array`.
- Top-20 candidates → 1 batch call (≤8 jobs in output to keep tokens manageable; spec says 5-10).
- `maxOutputTokens: ~10000` for batch JSON; fallback to 5-job request if model throws output-too-long.
- Cost guard: before LLM call → `checkKillSwitch('job-recommend')`; after call → `recordCost('job-recommend', microUsd)`.

## Requirements

### Functional
- F1. `POST /api/jobs/recommend` with body `{ cvText: string, llm?: { provider, model, temperature } }`.
- F2. Quota check via `consumeQuotaForUser` / `consumeQuotaForAnon` with bucket `'job-recommend'`.
- F3. Cost-guard check before LLM call.
- F4. HMAC cache lookup → KV `embed-cache:<hmac>` (TTL 6h).
- F5. Cache miss → embed via Gemini text-embedding-004 → store in KV with TTL.
- F6. Cosine sim against `embeddings:active:v<n>` blob → top 20 candidates.
- F7. Single LLM batch call (Gemini Flash by default; BYOK supported) → JSON `{ jobs: JobMatch[] }`.
- F8. Filter `overallScore > 80`, sort desc, slice to 5-10.
- F9. Normalize + validate against `JobMatch` shape; reject incomplete entries.
- F10. Response: `{ jobs: JobMatch[], fromCache: boolean, expiresAt: ISOString, quotaRemaining: number | null }`.
- F11. Cost recording: `recordCost('job-recommend', microUsd)` after successful LLM call.

### Non-functional
- p95 latency < 8s end-to-end (embed cache hit < 4s).
- Each lib file < 200 LOC.
- BYOK path: zero shared-key cost; quota unlimited per existing pattern.
- Errors surface via humanize-error (no silent heuristic fallback — per memory rule).
- Module-memory cache of embedding blob bounded: invalidate when `embeddings:active:current` version changes (re-check every 60s).

## Architecture

### Endpoint data flow

```
POST /api/jobs/recommend
  │
  ├─ 1. Parse body (zod): RecommendBody
  │
  ├─ 2. resolveApiKey(llm, 'job-recommend', {byokToken, ip})
  │       └─ checks BYOK first, else shared key + quota
  │
  ├─ 3. costGuard.checkKillSwitch('job-recommend') → if !ok → 503
  │
  ├─ 4. embedCache.get(cvText)
  │       hmac = HMAC-SHA256(cvText, EMBED_CACHE_SECRET).hex
  │       cached = kv.get('embed-cache:<hmac>')
  │       if cached → fromCache=true, embedding = base64→Float32Array
  │       else → embedding = await embedText(cvText, geminiKey)
  │              kv.set('embed-cache:<hmac>', base64(embedding), { ex: 21600 })
  │              fromCache=false
  │
  ├─ 5. candidates = topKCandidates(embedding, k=20)
  │       └─ load module-memory blob; recompute when version changes
  │       └─ cosineSim(emb, jobEmb) → score, sort desc, slice 20
  │
  ├─ 6. jobs = await repo.getJobBatch(candidates.map(c => c.id))  // HMGET batch
  │
  ├─ 7. { system, user } = buildRecommendPrompts(cvText, jobs)
  │       └─ system: VN job market expert + JSON schema + STRICT no markdown
  │       └─ user: { cv, candidates: [{id,title,company,vertical,seniority,description}] }
  │
  ├─ 8. raw = callLLM({ provider, model, maxOutputTokens: 10000, expectJson: true })
  │
  ├─ 9. parsed = safeParseJson(raw) → normalizeRecommend(parsed)
  │       └─ Filter overallScore > 80, slice to 10, enrich with original job fields needed by UI
  │
  ├─ 10. costGuard.recordCost('job-recommend', estimatedMicroUsd(promptTokens, completionTokens, model))
  │
  ├─ 11. logLlmCall({ endpoint: 'job-recommend', ...stats })
  │
  └─ 12. Return { jobs, fromCache, expiresAt: now+6h, quotaRemaining }
```

### LLM batch prompt structure (system)

```
You are a Vietnam job-market expert. Given a CV and 20 candidate jobs, output STRICT JSON with this schema:

{
  "jobs": [
    {
      "jobId": string,
      "overallScore": number 0-100,
      "dimensionScores": {
        "skills": 0-100, "experience": 0-100, "education": 0-100, "industry": 0-100,
        "seniority": 0-100, "location": 0-100, "tools": 0-100, "soft": 0-100, "domain": 0-100
      },
      "matchReasons": string[3-5],
      "studyTopics": [
        { "name": string, "category": "frontend"|"backend"|"db"|"devops"|"soft"|"domain",
          "tier": "basic"|"intermediate"|"advanced",
          "whyForThisJob": string (1-2 sentences citing JD),
          "estimatedHours": string e.g. "4-8h" }
      ] (5-10 per job)
    }
  ]
}

Rules:
- Output ONLY top jobs with overallScore > 80; 5-10 total.
- studyTopics must be specific to the JD, not generic.
- whyForThisJob must reference concrete JD terms.
- NO markdown, NO prose, NO explanation outside JSON.
- Vietnamese language for matchReasons + whyForThisJob.
```

### Cosine sim + top-K

```
cosineSim(a: Float32Array, b: Float32Array): number
  // assumes both 768-dim
  let dot = 0; for (i=0;i<768;i++) dot += a[i]*b[i];
  // embeddings from Gemini text-embedding-004 are normalized → dot = cosine

topKCandidates(query, k=20):
  scores = jobs.map(j => ({ id: j.id, score: cosineSim(query, j.emb) }))
  return scores.sort(desc).slice(0, k)
```

### Module-memory blob cache

```
let memCache: { version: string; ids: string[]; vecs: Map<string, Float32Array>; loadedAt: number } | null;
const TTL_MS = 60_000;

async function getEmbeddings(): Promise<typeof memCache> {
  if (memCache && Date.now() - memCache.loadedAt < TTL_MS) return memCache;
  const v = await kv.get('embeddings:active:current');
  if (memCache?.version === v) { memCache.loadedAt = Date.now(); return memCache; }
  // reload
  const { ids, chunks } = await repo.loadBlobChunks(v);
  const vecs = unpackEmbeddings(ids, Buffer.concat(chunks));
  memCache = { version: v, ids, vecs, loadedAt: Date.now() };
  return memCache;
}
```

## Related Code Files

### New
- `cv-ex-refactor/src/app/api/jobs/recommend/route.ts` (<200 LOC, route handler — orchestration only)
- `cv-ex-refactor/src/lib/jobs/score.ts` (<200 LOC, cosineSim, topKCandidates, module-memory cache)
- `cv-ex-refactor/src/lib/jobs/embed-cache.ts` (<100 LOC, HMAC-keyed CV embedding cache)
- `cv-ex-refactor/src/lib/llm/prompt-job-recommend.ts` (<200 LOC, system + user prompt builders)
- `cv-ex-refactor/src/lib/llm/normalize-job-recommend.ts` (<200 LOC, parse + validate + enrich)
- `cv-ex-refactor/src/lib/schemas/job-recommend-request.ts` (<100 LOC, zod schemas)

### Modified
- `cv-ex-refactor/src/lib/llm/model-prices.ts` — confirm Gemini Flash entry exists for cost estimate (no edit if present).
- `cv-ex-refactor/src/lib/llm/resolve-api-key.ts` — confirm `'job-recommend'` accepted as quota action (may need type widening if not done in Phase 0).

### NOT touched
- Phase 1 files are read-only here (`repo.ts`, `embed.ts`, `pack-embeddings.ts`).

## Implementation Steps

1. **Request schema.** Create `lib/schemas/job-recommend-request.ts` with zod `RecommendBody = { cvText: string.min(200).max(20000), llm: LLMConfig.optional() }`. Default `llm = { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.3 }`.
2. **HMAC cache.** Create `lib/jobs/embed-cache.ts`:
   - `getCachedEmbedding(cvText: string): Promise<Float32Array | null>` — HMAC key via `crypto.createHmac('sha256', EMBED_CACHE_SECRET).update(cvText).digest('hex')`, `kv.get('embed-cache:<hmac>')`, base64→Float32Array.
   - `setCachedEmbedding(cvText: string, emb: Float32Array): Promise<void>` — TTL 21600s (6h).
   - Fail-closed if `EMBED_CACHE_SECRET` missing in prod (throw → 503 with config error). Dev fallback: skip cache + warn.
3. **Score lib.** Create `lib/jobs/score.ts`:
   - `cosineSim(a, b): number`
   - `getEmbeddingsMemo(): Promise<{version, ids, vecs}>` (module-memory + 60s revalidate).
   - `topKCandidates(query: Float32Array, k=20): Promise<Array<{id, score}>>`.
4. **Prompt builder.** Create `lib/llm/prompt-job-recommend.ts`:
   - `buildRecommendPrompts({ cvText, candidates }: { cvText: string; candidates: CandidateInput[] }): { system: string; user: string }`.
   - System prompt = JSON schema strict + Vietnamese language directive.
   - User prompt = stringified `{ cv, candidates }` with each candidate truncated to ~800 chars JD to keep prompt size sane.
5. **Normalizer.** Create `lib/llm/normalize-job-recommend.ts`:
   - `normalizeRecommend(raw: unknown, jobsById: Map<string, Job>): JobMatch[]` — zod-parse, drop invalid entries, drop `overallScore <= 80`, slice top 10, enrich each match with `title, company, location, sourceUrl` from `jobsById` (UI needs these).
   - Drop matches whose `jobId` is not in `jobsById` (LLM hallucinated id).
6. **Route handler.** Create `app/api/jobs/recommend/route.ts`:
   - Parse + validate body.
   - Resolve API key (shared or BYOK), consume quota for `'job-recommend'`.
   - `await costGuard.checkKillSwitch('job-recommend')` → 503 if blocked.
   - Get CV embedding via cache or `embedText`.
   - `await topKCandidates(emb, 20)` → fetch jobs via `repo.getJobBatch`.
   - `buildRecommendPrompts` → `callLLM` (provider/model from body or defaults; `maxOutputTokens: 10000`).
   - `safeParseJson` → if null, retry once with `maxOutputTokens: 12000`; if still null, return `llm_provider_error` (humanized message).
   - `normalizeRecommend` → if empty array, return 502 with "no matches above threshold; try a more detailed CV".
   - `costGuard.recordCost('job-recommend', estimatedMicroUsd)` (use `model-prices.ts`).
   - `logLlmCall(...)`.
   - Return `{ jobs, fromCache, expiresAt, quotaRemaining }`.
7. **Error matrix:**
   - 400 `invalid_input` — cvText too short/long
   - 401 `unauthorized` — BYOK token invalid
   - 429 `quota_exceeded` — daily quota hit
   - 503 `service_unavailable` — kill-switch active or `EMBED_CACHE_SECRET` missing
   - 502 `llm_provider_error` — JSON parse fail / empty payload / model error
   - 500 `internal_error` — KV write fail (rare; logged)
8. **Smoke local:**
   - Hit `/api/jobs/recommend` with a 800-word VN tech CV.
   - Verify p95 < 8s on 5 sequential calls (cache hit on calls 2-5).
   - Verify `fromCache: true` on call #2.
   - Verify `kv.get('metrics:cost:<YMD>:job-recommend')` increments.
9. **Compile check.** `npm run build` clean.

## Todo List
- [ ] H2.1 `lib/schemas/job-recommend-request.ts` zod
- [ ] H2.2 `lib/jobs/embed-cache.ts` HMAC + KV TTL
- [ ] H2.3 `lib/jobs/score.ts` cosineSim + module memo + topK
- [ ] H2.4 `lib/llm/prompt-job-recommend.ts` strict-JSON prompts
- [ ] H2.5 `lib/llm/normalize-job-recommend.ts` parse + filter + enrich
- [ ] H2.6 `app/api/jobs/recommend/route.ts` orchestration
- [ ] H2.7 Error humanization wired
- [ ] H2.8 Cost guard pre-check + post-record
- [ ] H2.9 Smoke local: cache miss + hit, p95 < 8s
- [ ] H2.10 Compile check `npm run build`

## Success Criteria
- Hitting endpoint with real VN tech CV returns ≥3 jobs with `overallScore > 80` in < 8s.
- 2nd call within 6h returns `fromCache: true` and < 4s.
- `kv.get('metrics:cost:<YMD>:job-recommend')` matches estimated cost ± 10%.
- `kv.get('kill-switch:job-recommend')` autosets to '1' when synthetic `recordCost` pushes total > $3.
- Unit test: `normalizeRecommend` rejects items with missing dimensionScores, jobId not in map, or overallScore ≤ 80.
- Unit test: `cosineSim` on two known vectors equals expected value.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM returns 0 jobs > 80 (CV mismatch all 20 candidates) | M | M | Surface error to UI: "Không có job nào khớp đủ cao. Thử cập nhật CV." — NOT a heuristic fallback (per memory rule) |
| Output JSON truncated at 10K tokens | M | H | Retry once with 12K; if still fail, prompt v2: reduce 10→5 jobs to halve output |
| Embedding blob memory grows past safe heap (Vercel 1GB) | L | M | 150 jobs × 3KB = 450KB. Scaling guard at 2000 jobs: log warn. Chunked design lets us swap to per-chunk lazy load. |
| `EMBED_CACHE_SECRET` rotated mid-cache TTL → all CV cache misses | L | L | Acceptable: 6h TTL means transient cost spike, self-heals |
| Cost guard race: two concurrent calls cross kill threshold simultaneously | L | M | `kv.incrby` is atomic; second call sees updated total post-increment and trips kill-switch |
| Quota integration regression on other buckets | L | H | Run existing analyze quota unit tests; only widened union types |
| BYOK user hits Gemini-text-embedding free-tier exhaustion | M | L | BYOK key bills user's own GCP project — failure surfaces as 502; document in privacy/help |

## Security Considerations
- `EMBED_CACHE_SECRET` MUST be present in prod env (Phase 0 guarantee). Code throws explicit 503 if missing — does not silently disable cache.
- HMAC prevents enumeration: attacker can't reverse `embed-cache:<hmac>` to detect if specific CV was processed.
- CV text never logged (only `inputChars` count via `logLlmCall`).
- BYOK token only forwarded to LLM provider; never written to KV.
- Module-memory cache holds **only** job embeddings (public data); CV-derived embedding never stored in memory across requests.
- Rate-limit anon via IP (`enforce-ip-rate-limit.ts` already exists; reuse).

## Next Steps
- **Blocks:** Phase 3 UI (page consumes this endpoint).
- **Depends on:** Phase 0 (HMAC secret, cost guard, quota bucket), Phase 1 (repo, embed, pack-embeddings, seed data).
- **Unblocks:** Phase 3 (UI), Phase 4 (admin dashboard surfaces metric keys produced here).
