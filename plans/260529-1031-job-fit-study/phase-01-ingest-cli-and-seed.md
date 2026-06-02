# Phase 01 — Ingest CLI + 150 Seed Jobs + Embedding Blob

## Context Links
- Spec: `plans/reports/spec-260529-1031-job-fit-study.md` (Ingest pipeline, Data model)
- Phase 0: `plan/260529-1031-job-fit-study/phase-00-hardening.md` (EMBED_CACHE_SECRET, quota bucket)
- Reference embedding usage: Gemini text-embedding-004 (768 dim, free 1500/day)
- KV access: `cv-ex-refactor/src/lib/quota/kv-client.ts`
- LLM key resolve: `cv-ex-refactor/src/lib/llm/resolve-api-key.ts`

## Overview
- **Priority:** P1 — blocks Phase 2
- **Status:** pending
- **Description:** Build the offline CLI tool to ingest jobs (paste/file/stats/expire/rebuild-embeddings), seed 150 jobs (80 tech / 30 marketing / 20 finance / 20 sales-ops), and produce the chunked `embeddings:active:v<n>` KV blob loaded by the recommend endpoint.

## Key Insights
- CLI is **offline / dev-machine only** — uses operator's `GEMINI_API_KEY` from `.env.local` (NOT the shared key). No production runtime.
- 150 jobs × 768 floats × 4 bytes = ~460 KB raw. Chunked at 250 jobs/chunk → fits in one chunk for v1 but **must** be chunked-by-design so v0.3b scraper expansion doesn't break.
- Embedding storage format: base64-encoded `Float32Array` per job (in `job:<id>`) **and** packed packed blob `embeddings:active:v1` for fast cold-start cosine sim (avoid 150 KV roundtrips).
- Versioned key (`v<n>`) lets us atomic-swap embeddings on model upgrade without downtime.
- Job ID: `sha256(sourceUrl).slice(0,16)` — deterministic, idempotent re-ingest on same URL is a no-op.
- Heuristic `classify.ts` (vertical + seniority) reads title + company industry keyword; LLM **not** invoked at ingest time (cost + free-tier conservation).

## Requirements

### Functional
- F1. `npm run ingest paste` — interactive prompt for one job's fields, auto-detect vertical/seniority, confirm, save.
- F2. `npm run ingest file <path>` — read JSON array of partial-job objects, dedup by `sourceUrl` against existing `jobs:active`, run classifier, embed, store.
- F3. `npm run ingest stats` — print `{ active, expired, byVertical, bySeniority }`.
- F4. `npm run ingest expire` — for each job in `jobs:active`, if `verifiedAt > 21d` move to `jobs:expired` set.
- F5. `npm run ingest rebuild-embeddings` — pack all `jobs:active` embeddings into chunked blob `embeddings:active:v<n+1>` then atomic-swap pointer `embeddings:active:current` to `v<n+1>`.
- F6. Seed data: 150 jobs JSON file with required fields filled (id auto-computed at ingest).
- F7. Each job stored as `job:<id>` hash + `jobs:active` SADD; embedding stored both in `job:<id>` and in packed blob.

### Non-functional
- CLI startup < 2s (no heavy deps; lazy-import gemini client).
- Embedding call rate-limit: 5 req/s max (Gemini free-tier headroom).
- Each lib file < 200 LOC (project rule).
- CLI graceful on Ctrl-C (write progress to `data/ingest-progress.json`).

## Architecture

### Data flow

```
seed-jobs.json (array of partial jobs)
        │
        ▼
ingest-jobs.ts CLI
        │
        ├─ For each partial:
        │    1. id = sha256(sourceUrl).slice(0,16)
        │    2. SISMEMBER jobs:active id → skip if dup
        │    3. classify(title, company) → { vertical, seniority }
        │    4. embed(title + " " + description) → Float32Array(768)
        │    5. base64 encode → embedding string
        │    6. HSET job:<id> { ...fields, embedding, verifiedAt: now }
        │    7. SADD jobs:active id
        │
        └─ After all done:
             8. Rebuild packed blob:
                 - Read all job:<id> → embedding
                 - Pack: [id_len(2B) | id_utf8 | emb(768*4B)] × N
                 - chunk into 250-job slabs
                 - SET embeddings:active:v<n>:chunk:0 → base64(blob_chunk_0)
                 - SET embeddings:active:v<n>:chunks → count
                 - SET embeddings:active:v<n>:ids → JSON of [id...]
                 - SET embeddings:active:current → 'v<n>'
```

### KV key layout

```
job:<id>                          HASH { title, company, vertical, seniority,
                                          description, sourceUrl, source,
                                          location, postedAt, verifiedAt, embedding }
jobs:active                       SET of job ids
jobs:expired                      SET of job ids
embeddings:active:current         STRING 'v1'
embeddings:active:v1:chunks       STRING '1' (chunk count)
embeddings:active:v1:ids          STRING JSON [id, id, ...]
embeddings:active:v1:chunk:0      STRING base64 packed blob
embed-cache:<hmac>                STRING base64 Float32Array (TTL 6h, Phase 2 only)
```

### Classifier heuristic

```
vertical:
  if company in { 'Vingroup','Techcombank','BIDV','VPBank',... } → 'finance'
  else if title matches /marketing|brand|content|seo|growth/i → 'marketing'
  else if title matches /sales|account exec|bd|business dev/i → 'sales'
  else if title matches /operation|coordinator|admin/i → 'ops'
  else if title matches /developer|engineer|dev|tech|data|qa|devops/i → 'tech'
  else 'other'

seniority:
  if title matches /intern/i → 'intern'
  else if title matches /senior|sr\b|sr\./i → 'senior'
  else if title matches /lead|principal|staff|head/i → 'lead'
  else if title matches /mid|middle/i → 'mid'
  else if title matches /junior|jr\b|fresher/i → 'junior'
  else 'mid'  (default)
```

## Related Code Files

### New
- `cv-ex-refactor/scripts/ingest-jobs.ts` (<200 LOC, entry point — sub-commands dispatch)
- `cv-ex-refactor/scripts/ingest-paste.ts` (<150 LOC, interactive paste flow)
- `cv-ex-refactor/scripts/ingest-file.ts` (<150 LOC, batch file flow)
- `cv-ex-refactor/scripts/ingest-stats.ts` (<100 LOC, stats sub-command)
- `cv-ex-refactor/scripts/ingest-expire.ts` (<100 LOC, expire sub-command)
- `cv-ex-refactor/scripts/ingest-rebuild-embeddings.ts` (<150 LOC, packing logic)
- `cv-ex-refactor/src/lib/jobs/types.ts` (<100 LOC, type defs from spec)
- `cv-ex-refactor/src/lib/jobs/repo.ts` (<200 LOC, KV CRUD: getJob, saveJob, listActive, listExpired, expireJob, loadEmbeddingsBlob, saveEmbeddingsBlob)
- `cv-ex-refactor/src/lib/jobs/classify.ts` (<100 LOC, heuristic vertical + seniority)
- `cv-ex-refactor/src/lib/jobs/embed.ts` (<150 LOC, Gemini text-embedding-004 wrapper, NO HMAC cache — Phase 2 adds CV cache)
- `cv-ex-refactor/src/lib/jobs/pack-embeddings.ts` (<150 LOC, pack/unpack chunked blob)
- `cv-ex-refactor/data/seed-jobs.json` (150 entries; non-secret, committed to repo)

### Modified
- `cv-ex-refactor/package.json` — add `"ingest": "tsx scripts/ingest-jobs.ts"` script + dev-dep `tsx` if not present.
- `cv-ex-refactor/.gitignore` — confirm `data/ingest-progress.json` ignored; `data/seed-jobs.json` NOT ignored.

## Implementation Steps

1. **Types.** Create `src/lib/jobs/types.ts` with `Vertical`, `Seniority`, `Tier`, `Job`, `StudyTopic`, `JobMatch` exactly per spec. Export everything.
2. **Repo.** Create `src/lib/jobs/repo.ts` with KV-backed CRUD:
   - `getJob(id): Promise<Job | null>` — `kv.hgetall`
   - `saveJob(job: Job): Promise<void>` — `kv.hset` + `kv.sadd('jobs:active', id)`
   - `listActiveIds(): Promise<string[]>` — `kv.smembers('jobs:active')`
   - `expireJob(id): Promise<void>` — `kv.smove('jobs:active', 'jobs:expired', id)`
   - `getActiveBlobVersion(): Promise<string>` — `kv.get('embeddings:active:current')`
   - `loadBlobChunks(version): Promise<{ ids: string[]; chunks: Buffer[] }>` (used by Phase 2).
3. **Pack/unpack.** Create `src/lib/jobs/pack-embeddings.ts`:
   - `packEmbeddings(jobs: Array<{id: string; embedding: Float32Array}>, chunkSize=250): { ids: string[][]; chunks: Buffer[] }`
   - `unpackEmbeddings(ids: string[], chunkBlob: Buffer): Map<string, Float32Array>`
   - Format: `Float32Array(768)` per job, packed contiguously by chunk's id-order.
4. **Classify.** Create `src/lib/jobs/classify.ts` — regex table per spec heuristic. Export `classifyVertical(title, company): Vertical` and `classifySeniority(title): Seniority`.
5. **Embed.** Create `src/lib/jobs/embed.ts`:
   - `embedText(text: string, apiKey: string): Promise<Float32Array>` — call Gemini `text-embedding-004` REST API, parse `embedding.values` to Float32Array.
   - Throttle: token-bucket 5 req/s.
   - Throws on API error (caller handles).
6. **CLI dispatcher.** Create `scripts/ingest-jobs.ts`:
   ```
   const [, , cmd, ...args] = process.argv;
   switch (cmd) { case 'paste': await runPaste(args); break; case 'file': await runFile(args); ... }
   ```
   Load `.env.local` via `dotenv/config`.
7. **Sub-commands.** Implement each in own file (paste, file, stats, expire, rebuild). Each calls into `lib/jobs/repo.ts` + `embed.ts` + `classify.ts`.
8. **Seed JSON.** Author `data/seed-jobs.json`:
   - 80 tech (mix junior/mid/senior, all VN companies: VNG, Tiki, Momo, FPT Software, KMS, Got It, Sky Mavis, etc.)
   - 30 marketing (Unilever VN, Shopee, Lazada, Vinamilk, Masan, etc.)
   - 20 finance (Techcombank, BIDV, ACB, VPBank, MB, Vietcombank, VNDirect, SSI)
   - 20 sales/ops (Grab, Be, Gojek-VN, retail chains)
   - Each: `title, company, description (50-200 words), sourceUrl, source, location, postedAt`. Drop `id, embedding, verifiedAt` (filled at ingest).
   - **Sourcing rule:** real URLs from itviec/topcv/vnw (manual paste, attribution preserved in `source` field). All descriptions paraphrased to summary form (no verbatim copyright violation).
9. **Run ingest once locally.** `npm run ingest file data/seed-jobs.json` → expect 150 jobs in `jobs:active`. Verify with `npm run ingest stats`.
10. **Rebuild embeddings.** `npm run ingest rebuild-embeddings` → produces `embeddings:active:v1`.
11. **Smoke unpack.** Add a quick `tsx scripts/smoke-load-embeddings.ts` (one-off, not committed) that reads the blob and prints first id + first 4 floats — verify roundtrip OK.
12. **Compile check.** `npm run build` clean.

## Todo List
- [ ] H1.1 Add `tsx` dep (if missing) + `ingest` npm script
- [ ] H1.2 `lib/jobs/types.ts`
- [ ] H1.3 `lib/jobs/repo.ts`
- [ ] H1.4 `lib/jobs/pack-embeddings.ts`
- [ ] H1.5 `lib/jobs/classify.ts`
- [ ] H1.6 `lib/jobs/embed.ts` (Gemini text-embedding-004 REST)
- [ ] H1.7 `scripts/ingest-jobs.ts` dispatcher
- [ ] H1.8 `scripts/ingest-paste.ts`
- [ ] H1.9 `scripts/ingest-file.ts`
- [ ] H1.10 `scripts/ingest-stats.ts`
- [ ] H1.11 `scripts/ingest-expire.ts`
- [ ] H1.12 `scripts/ingest-rebuild-embeddings.ts`
- [ ] H1.13 Author `data/seed-jobs.json` (150 entries)
- [ ] H1.14 Run ingest → 150 jobs in KV
- [ ] H1.15 Run rebuild-embeddings → blob exists
- [ ] H1.16 Smoke unpack verifies roundtrip
- [ ] H1.17 Compile check `npm run build`

## Success Criteria
- `npm run ingest stats` shows `{ active: 150, expired: 0, byVertical: { tech: 80, marketing: 30, finance: 20, sales: ~10, ops: ~10 } }`.
- `kv.get('embeddings:active:current')` returns `'v1'`.
- `kv.get('embeddings:active:v1:chunks')` returns `'1'` (150 fits in one 250-chunk).
- Smoke unpack prints valid Float32Array of length 768 for first job.
- `data/seed-jobs.json` committed to repo with attribution preserved per item (source URL).

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gemini free-tier rate-limit during ingest (1500/day) | L | M | Token-bucket 5 req/s in `embed.ts`; 150 calls × 0.2s = 30s — well under daily limit |
| `sha256(sourceUrl).slice(0,16)` collision | VL | H | 16 hex chars = 64 bits → ~1 collision per 4B URLs. For 150 jobs, negligible. Document migration path to 24 chars if pool > 1M. |
| Classifier mis-tags non-IT roles | M | L | Heuristic is best-effort; LLM batch in Phase 2 cross-checks vertical via JD text; manual review of 150 seed during authoring |
| Source URL copyright pushback | M | M | Paraphrased descriptions, source attribution preserved, takedown channel in `docs/privacy.md` |
| `seed-jobs.json` checked-in with PII (employer contact email) | L | H | Manual review pass; lint script greps `\b[\w.-]+@\b` and rejects commit |
| KV writes exceed Upstash free-tier in ingest | L | L | 150 × 3 writes = 450 ops, well under daily free limit |
| Embedding blob format incompatible across runtimes | L | M | Always use `Buffer` + base64; document chunk header layout in `pack-embeddings.ts` doc-comment |

## Security Considerations
- CLI reads operator's `GEMINI_API_KEY` from `.env.local` (NEVER commit).
- Seed JSON contains **only public job postings** — no PII, no internal company data.
- Embedding storage = vector only, no raw CV ever stored at ingest time (CV embeddings are Phase 2, runtime-only, TTL 6h).
- No user data touches this CLI (operator-only tool).
- Git pre-commit hook: reject `.env.local` accidentally staged (project rule, existing).

## Next Steps
- **Blocks:** Phase 2 (recommend endpoint loads `embeddings:active:current` blob via `repo.ts` — pattern lands here).
- **Depends on:** Phase 0 (env schema, EMBED_CACHE_SECRET not needed yet but quota bucket avoids merge conflict).
- **Unblocks after merge:** Phase 2 can start; Phase 4 refresh cron also re-uses `repo.expireJob` + `repo.listActive`.
