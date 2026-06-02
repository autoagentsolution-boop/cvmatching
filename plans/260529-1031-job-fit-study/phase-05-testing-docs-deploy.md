# Phase 05 — Testing + Docs + Smoke Deploy

## Context Links
- Spec: `plans/reports/spec-260529-1031-job-fit-study.md` (Success metrics, Risks)
- Phase 0-4: all prior phase files
- Existing test layout: `cv-ex-refactor/tests/**` (if present) or `cv-ex-refactor/src/**/*.test.ts`
- Changelog: `cv-ex-refactor/docs/project-changelog.md`
- Roadmap: `cv-ex-refactor/docs/development-roadmap.md`

## Overview
- **Priority:** P1 — ship gate
- **Status:** pending
- **Description:** Final tests (unit + integration smoke), full privacy.md, deployment.md runbook completion, smoke deploy to Vercel, changelog + roadmap update.

## Key Insights
- No e2e harness in repo (per existing structure). Smoke deploy = manual checklist on Vercel preview URL.
- Tests focus on **pure logic** units: cosine sim, pack/unpack embeddings, classifier, normalizer, refresh-batch with mocked fetch.
- Integration smoke = curl scripts against `localhost:3000` then against preview URL.
- Privacy doc is **deploy-blocking** per memory (`project_cvmatching_v01_state` — paused for data-privacy review). v0.3 privacy disclosures unblock deploy.

## Requirements

### Functional
- F1. Unit tests for: `cosineSim`, `packEmbeddings`/`unpackEmbeddings` roundtrip, `classifyVertical`/`classifySeniority`, `normalizeRecommend` (rejects bad ids, low scores, missing dims), `refreshBatch` (mocked fetch matrix).
- F2. Schema tests: `RecommendBody` zod, `TopicFeedbackRequest` zod (rejects `reason`).
- F3. Smoke checklist runnable as bash script in `scripts/smoke-job-fit.sh`.
- F4. `docs/privacy.md` complete (all 4 sections from Phase 0 expanded with concrete KV keys, retention windows, deletion process).
- F5. `docs/deployment.md` complete (envs, crons, KV keys list, kill-switch reset, ingest runbook, rollback per phase).
- F6. `docs/project-changelog.md` v0.3 entry.
- F7. `docs/development-roadmap.md` v0.3 marked shipped.
- F8. Vercel preview deploy smoke passes; merge to main; prod smoke passes.

### Non-functional
- All tests run < 10s.
- No test mocks the database mid-integration (per memory rule `feedback_testing` — integration uses real KV / local Upstash REST mock).
- Unit tests can use mocks freely.
- Smoke checklist is observer-readable (not just CLI).

## Architecture

### Test layout

```
cv-ex-refactor/
  tests/
    unit/
      cosine-sim.test.ts
      pack-embeddings-roundtrip.test.ts
      classify-vertical.test.ts
      classify-seniority.test.ts
      normalize-job-recommend.test.ts
      refresh-batch.test.ts
      schemas-recommend-body.test.ts
      schemas-topic-feedback.test.ts
    integration/
      recommend-endpoint-smoke.test.ts  (env-gated; skip if GEMINI_API_KEY missing)
      redirect-endpoint.test.ts
      feedback-endpoint.test.ts
  scripts/
    smoke-job-fit.sh
```

### Smoke checklist (`scripts/smoke-job-fit.sh`)

```bash
#!/usr/bin/env bash
# Smoke test v0.3 Job Fit & Study against $BASE_URL (default localhost:3000)
set -e
BASE_URL=${BASE_URL:-http://localhost:3000}
CV=$(< tests/fixtures/sample-cv-vn-tech.txt)

echo "1. POST /api/jobs/recommend (cache miss expected)"
RESP=$(curl -sX POST "$BASE_URL/api/jobs/recommend" -H 'Content-Type: application/json' -d "{\"cvText\":$(jq -Rs . <<< "$CV")}")
echo "$RESP" | jq '.jobs | length'  # expect >= 3

echo "2. POST /api/jobs/recommend (cache hit expected)"
RESP2=$(curl -sX POST "$BASE_URL/api/jobs/recommend" -H 'Content-Type: application/json' -d "{\"cvText\":$(jq -Rs . <<< "$CV")}")
echo "$RESP2" | jq '.fromCache'  # expect true

JOB_ID=$(echo "$RESP" | jq -r '.jobs[0].jobId')

echo "3. GET /api/r/$JOB_ID (expect 302)"
curl -sI "$BASE_URL/api/r/$JOB_ID" | grep -E '^HTTP/.*302'

echo "4. POST /api/topics/feedback (expect 204)"
curl -sX POST "$BASE_URL/api/topics/feedback" \
  -H 'Content-Type: application/json' \
  -d "{\"jobId\":\"$JOB_ID\",\"topicId\":\"react-hooks\",\"action\":\"dislike\"}" -w '%{http_code}\n'

echo "5. POST /api/topics/feedback with reason (expect 400)"
curl -sX POST "$BASE_URL/api/topics/feedback" \
  -H 'Content-Type: application/json' \
  -d "{\"jobId\":\"$JOB_ID\",\"topicId\":\"react-hooks\",\"action\":\"dislike\",\"reason\":\"meh\"}" -w '%{http_code}\n'

echo "6. GET /api/jobs/refresh (with auth)"
curl -s -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/jobs/refresh" | jq

echo "All smoke checks completed."
```

## Related Code Files

### New
- `cv-ex-refactor/tests/unit/cosine-sim.test.ts`
- `cv-ex-refactor/tests/unit/pack-embeddings-roundtrip.test.ts`
- `cv-ex-refactor/tests/unit/classify-vertical.test.ts`
- `cv-ex-refactor/tests/unit/classify-seniority.test.ts`
- `cv-ex-refactor/tests/unit/normalize-job-recommend.test.ts`
- `cv-ex-refactor/tests/unit/refresh-batch.test.ts`
- `cv-ex-refactor/tests/unit/schemas-recommend-body.test.ts`
- `cv-ex-refactor/tests/unit/schemas-topic-feedback.test.ts`
- `cv-ex-refactor/tests/integration/recommend-endpoint-smoke.test.ts`
- `cv-ex-refactor/tests/integration/redirect-endpoint.test.ts`
- `cv-ex-refactor/tests/integration/feedback-endpoint.test.ts`
- `cv-ex-refactor/tests/fixtures/sample-cv-vn-tech.txt`
- `cv-ex-refactor/scripts/smoke-job-fit.sh`

### Modified (final pass)
- `cv-ex-refactor/docs/privacy.md` — expand 4 sections with KV keys, TTLs, deletion process.
- `cv-ex-refactor/docs/deployment.md` — full runbook.
- `cv-ex-refactor/docs/project-changelog.md` — v0.3 entry.
- `cv-ex-refactor/docs/development-roadmap.md` — v0.3 status.
- `cv-ex-refactor/docs/system-architecture.md` — add Job Fit subsystem diagram.

## Implementation Steps

1. **Unit tests — pure math.**
   - `cosine-sim.test.ts`: two known vectors → expected dot. Normalized inputs → 0..1 range. Zero vector → 0.
   - `pack-embeddings-roundtrip.test.ts`: pack N=3, unpack, assert byte-level equality of each Float32Array.
2. **Unit tests — classifiers.**
   - `classify-vertical.test.ts`: table-driven 30 rows covering each `Vertical`.
   - `classify-seniority.test.ts`: table-driven 20 rows; "Senior Software Engineer" → 'senior', "Intern Marketing" → 'intern', "Engineering Manager" → 'lead', etc.
3. **Unit tests — normalizer.**
   - `normalize-job-recommend.test.ts`: feed crafted LLM JSON; assert: bad ids dropped, score ≤ 80 dropped, missing dims dropped, max 10 jobs returned, enriched fields present.
4. **Unit tests — schemas.**
   - `schemas-recommend-body.test.ts`: rejects cvText < 200 chars and > 20000.
   - `schemas-topic-feedback.test.ts`: accepts `{ jobId, topicId, action }`; rejects `reason` key; rejects unknown keys (`.strict()` proof).
5. **Unit tests — refresh batch.**
   - `refresh-batch.test.ts`: mock `fetch` returning 200/404/410/timeout; assert `repo.expireJob` called for 404; `repo.touchVerifiedAt` called for 200; sleep respected (timer mock).
6. **Integration tests** (env-gated):
   - `recommend-endpoint-smoke.test.ts`: skip if `!process.env.GEMINI_API_KEY`. Otherwise hit local route with sample CV, assert response shape.
   - `redirect-endpoint.test.ts`: seed one job in KV, hit redirect, assert 302 + Location.
   - `feedback-endpoint.test.ts`: post valid + invalid; assert 204/400.
7. **Smoke script.** Author `scripts/smoke-job-fit.sh` (above).
8. **Fixture.** Create `tests/fixtures/sample-cv-vn-tech.txt` — realistic 600-word Vietnamese frontend developer CV (no real PII; fictional).
9. **Privacy doc — full version.** Modify `docs/privacy.md`:
   - **CV embedding cache:** key `embed-cache:<hmac>`, TTL 21600s, value = base64 Float32Array(768), HMAC keyed via `EMBED_CACHE_SECRET`. Deletion: `kv.del('embed-cache:<hmac>')` or 6h passive expiry. Rotation: rotate `EMBED_CACHE_SECRET` quarterly.
   - **JD-to-LLM:** Job descriptions + CV text sent to Gemini Flash via Google Cloud. Retention per Google AI TOS (no fine-tune). No model retraining on inputs.
   - **Vertical classifier:** Pure regex heuristic on title + company. Runs server-side at ingest. No LLM call.
   - **Redirect tracking:** `/api/r/[jobId]` records jobId + day bucket only. No IP, no UA, no user id stored. Aggregated metrics keys: `metrics:click:<jobId>:<YMD>`, `metrics:click:total:<YMD>`, TTL 2 days.
   - **Topic feedback:** `dislikes:<topicId>:<weekYMD>` counter only. No free-form text accepted (schema `.strict()` enforced).
   - **Takedown channel:** documented email + process.
10. **Deployment doc — full version.** Modify `docs/deployment.md`:
    - Required envs: `GEMINI_API_KEY` (shared), `EMBED_CACHE_SECRET`, `ADMIN_USER_IDS`, `CRON_SECRET`, `ALERT_WEBHOOK_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
    - Vercel cron schedule (3 ticks @ 20/21/22 UTC).
    - Ingest CLI runbook (paste/file/stats/expire/rebuild-embeddings).
    - Kill-switch reset commands.
    - Rollback per phase (copy from `plan.md`).
    - Quota bucket table.
    - KV key inventory (all `job:*`, `jobs:*`, `embeddings:*`, `metrics:*`, `embed-cache:*`, `dislikes:*`, `topic-feedback:*`, `refresh:cursor`, `kill-switch:*`).
11. **Changelog.** Append v0.3 entry to `docs/project-changelog.md` with: feature summary, new envs, new endpoints, new quota bucket, file count delta.
12. **Roadmap.** Update `docs/development-roadmap.md` — mark v0.3 shipped with date.
13. **System architecture.** Update `docs/system-architecture.md` — add subsection "Job Fit & Study" with the data-flow diagram from spec.
14. **Local smoke.** Run `bash scripts/smoke-job-fit.sh` against localhost. Fix any failures.
15. **Compile + test gate.** `npm run build` clean; `npm test` all unit pass.
16. **Vercel preview deploy.** Push branch; let Vercel build preview URL.
17. **Preview smoke.** Run `BASE_URL=https://<preview>.vercel.app bash scripts/smoke-job-fit.sh`.
18. **Merge + prod smoke.** Merge to main; same smoke against prod.
19. **Post-deploy verification:** `kv.get('embeddings:active:current')` returns version; admin dashboard shows job-fit panel; one real /job-fit run from refined-cv works end-to-end.

## Todo List
- [ ] H5.1 Unit tests: cosine-sim, pack-embeddings roundtrip
- [ ] H5.2 Unit tests: classifiers (vertical + seniority)
- [ ] H5.3 Unit tests: normalize-job-recommend
- [ ] H5.4 Unit tests: schemas (recommend body + topic-feedback strict)
- [ ] H5.5 Unit tests: refresh-batch with mocked fetch
- [ ] H5.6 Integration tests: recommend + redirect + feedback (env-gated)
- [ ] H5.7 `scripts/smoke-job-fit.sh` + fixture CV
- [ ] H5.8 `docs/privacy.md` full version
- [ ] H5.9 `docs/deployment.md` full runbook
- [ ] H5.10 `docs/project-changelog.md` v0.3 entry
- [ ] H5.11 `docs/development-roadmap.md` v0.3 shipped
- [ ] H5.12 `docs/system-architecture.md` Job Fit subsystem
- [ ] H5.13 `npm run build` + `npm test` clean
- [ ] H5.14 Local smoke passes
- [ ] H5.15 Vercel preview smoke passes
- [ ] H5.16 Prod smoke after merge
- [ ] H5.17 Post-deploy verification

## Success Criteria
- All unit tests green; `npm test` exit 0.
- `bash scripts/smoke-job-fit.sh` (against localhost + against prod) exits 0 with expected outputs at each step.
- `docs/privacy.md` reviewed by user/legal proxy; covers all 5 disclosures with concrete keys.
- `docs/deployment.md` self-contained runbook; new operator can deploy fresh from doc alone.
- Vercel prod build succeeds.
- Manual smoke on prod URL: `/refined-cv` → CTA → `/job-fit` → 5+ jobs → click card → detail page → click "Apply" → 302 redirect → return → dislike one topic → no error.
- Changelog + roadmap reflect v0.3 shipped.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Privacy review blocks deploy | M | H | Privacy doc drafted Phase 0 + finalized Phase 5; user reviews before merge |
| Integration tests need real Upstash | M | M | Env-gated; skip in CI without secrets; document local Upstash REST setup |
| Smoke script flaky against prod (LLM variance) | M | M | Assert structural shape only (jobs.length >= 3), not specific content |
| Vercel cron schedule typo → no refresh runs | L | H | `vercel.ts` type-check (`npx tsc --noEmit`) + post-deploy: hit `/api/jobs/refresh` manually with `Authorization: Bearer $CRON_SECRET`, verify `metrics:refresh:<YMD>` increments |
| Quota leak: anon user discovers shared key path | L | M | Existing rate-limit + bucket enforce; verify with curl from anon IP |
| Changelog conflict on merge | L | L | Rebase before merge; append-only entries |
| Test fixture leaks real PII | L | H | Fictional name/email/phone; review before commit; lint script greps real domains |
| KV emptied between unit and integration tests | M | M | Integration tests use namespaced keys `test:<runId>:*`; teardown deletes |

## Security Considerations
- Fixture CV must be **fictional** — review for accidental real-name/email leaks.
- Integration test API key (`GEMINI_API_KEY`) read from local env only; never in CI logs.
- Smoke script `CRON_SECRET` passed via env, not argv (avoid shell history leak).
- Privacy doc updated **before** prod deploy — non-negotiable per project memory.
- Document data deletion request channel (email + SLA).

## Next Steps
- **Blocks:** None — final phase. v0.3 ships.
- **Depends on:** Phases 0-4 all merged.
- **Post-ship:** Monitor success metrics for 2 weeks per spec (activation 30%, engagement 40%, dislike <15%, CTR 15%, cost <$1/day). Plan v0.3.5 (resource links) if signal strong.
