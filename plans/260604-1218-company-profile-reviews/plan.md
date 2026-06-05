---
name: company-profile-reviews
title: Company Profile + Reviews on Job Fit Detail
status: in-progress
created: 2026-06-04
shipped_partial: 2026-06-05
owner: vinh2000ld11@gmail.com
blockedBy: []
blocks: []
related: [260603-1655-ingest-taxonomy, 260602-1739-hybrid-refresh-topup, project_post_pilot_db_migration]
effort: 14-22h (Phase A 6-9h, Phase B 5-8h, Phase C deferred post-pilot)
---

# Company Profile + Reviews on Job Fit Detail

## Status — EOD 2026-06-05

**4 of 7 phases SHIPPED (lite scope each):**

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 01 — Entity + alias resolver | ✅ shipped | `6ed66ec` | 1013 LOC + 49 tests |
| 02 — Tier 1 scrape (ingest hook) | ✅ shipped (lite — ITviec only) | `e9d63de` | TopCV/VNW/VL24H parsers stub |
| 03 — External ratings | ⏸ deferred | — | research locked scrape+link-out |
| 04 — UI Company card | ✅ shipped (lite) | `e1dedae` | 5 render states; no sticky sidebar restructure |
| 05 — LLM enrichment endpoint | ✅ shipped (lite) | `9615f56` | Gemini grounding + 8th cost bucket |
| 06 — Suspense progressive | ⏸ deferred | — | current GET+POST pattern sufficient |
| 07 — Admin tooling (CLI/UI/cron) | ⏸ deferred | — | 1 entry point spec'd, none built |

Brainstorm + 4 original locked decisions in `reports/brainstorm-260604-1218-company-profile-reviews.md`. 5 additional decisions locked this session (see below).

## Locked decisions — session 2026-06-05 14:10

| # | Decision | Source |
|---|---|---|
| L1 | **Rating sources:** scrape ITviec/TopCV/VNW company section (primary) + Google search link-out (fallback). Drop Glassdoor/LinkedIn official APIs (enterprise-gated, $6K+/mo); defer Google Places API ($144/yr) until pilot shows ≥30% of companies have Maps listings | Q1 answer + research-260605-1407 |
| L2 | **LLM enrichment trigger:** hybrid — lazy on first detail-page open per company (30d cache) + weekly cron that refreshes only companies with ≥1 active job in last 7d. Avoids pre-warming dead companies | Q2 answer |
| L3 | **Backfill 150 existing jobs with `companyId`:** mixed strategy — auto-merge at ≥0.95 LLM confidence, queue 0.7-0.95 for admin review, mint-new for <0.7. ~1h LLM (~$0.50) + 1-2h admin review labor. Run as one-off script in Phase 02 | Q3 answer + spec §7 |
| L4 | **Stale UX:** show "Updated Nd ago" stamp only when tier1 expired (>90d); silent when fresh. Admin dashboard sees stamp always | Q4 answer |
| L5 | **Admin refresh tool:** 3 entry points — CLI (`pnpm run company-refresh`), Admin UI button, weekly cron (`/api/companies/refresh-cron`, Sunday 03:00 ICT). All call same `refreshCompany(slug, opts)` lib (DRY) | Phase A intent + spec §11 |

## Inspirations from `job_intelligence_local_spec.html` (2026-06-05 reference)

Port these patterns into CVMatching TypeScript codebase (not building separate Python tool):

- **3-level dedup ladder** (canonical_url → source_job_id → company+title+location → fuzzy ≥0.90 company / ≥0.85 title / ≥0.75 JD) — already aligned with plan's ≥0.95 auto-merge, additional fuzzy tier added for Phase 02
- **Normalization rules** — VN-specific: strip "Cty/TNHH/JSC/Cổ phần/Ltd/Inc"; map "HCMC/Saigon/Hồ Chí Minh" → "ho chi minh city" — port into `lib/companies/normalize.ts` + new `lib/jobs/normalize-location.ts`
- **"Never auto-delete duplicates, mark with duplicate_group_id"** — matches existing `feedback_ingest_freshness_constraint`
- **Adapter-based source design** — already in `lib/scrape/sources/*`
- **`review_link` as Google search URL placeholder** — Phase 03 uses this for Glassdoor/Indeed link-out

## Shipped scope (2026-06-05 EOD)

Originally planned Phase 01 → 02 → 04 (~6-9h). **Delivered Phase 01 + 02 lite + 04 lite + 05 lite in ~3h** (faster than estimate because phase plans were rock-solid).

**Lite scope shed across phases:**
- Phase 02 lite: ITviec parser only; TopCV/VNW/VL24H dispatcher returns 'parser-not-implemented' → caller mints tier1Pending stub. 150-job backfill deferred.
- Phase 04 lite: single-column layout (no sticky sidebar); 5 render states; no ratings/enrichment Suspense.
- Phase 05 lite: lazy on first detail-open + 30d cache. No weekly cron, no PII regex, no IP rate-limit, no Pushover 80% budget alert.

## Critical post-ship discovery — pool gap

User CV "senior data engineer" → Job Fit always returns same 2 jobs (Weldcom IT support + Chatbot Node.js Backend). Pool stats: tech 9/150, senior 1/150, tech.data ~0. Recommend pipeline filters by VERTICAL only (not sub-vertical) → 6 nearest-cosine in 9 tech jobs → backend/IT fallback. Phase 05 enrichment can't fix this — it's an ingest coverage gap.

**Locked solution:**
- Short: manual paste 5-10 data eng jobs via `pnpm run ingest paste` (user in-flight).
- Medium: `scripts/ingest-urls.ts` batch helper — takes URL args, JSON-LD JobPosting parse (reuse vl24h-parser pattern), runs through ingest-file flow. ~70 LOC, next session.
- Long: Phase 4 destructive re-ingest with broader filter + senior bias.

## Next session pickup (priority order)

1. Build `scripts/ingest-urls.ts` batch helper + add `pnpm run ingest urls <url>...` command to ingest-jobs.ts dispatcher
2. §17 docs sync — kill-switch bucket count 7 → 8 (`company-enrich` added)
3. TopCV/VNW/VL24H source parsers — port ITviec pattern
4. Phase 4 destructive re-ingest (needs explicit user go)
5. 150-job backfill standalone script (LLM dedup at ≥0.95 auto)
6. Phase 06 Suspense + Phase 07 admin tooling (lower priority)

## Problem

Job Fit detail page (`src/features/job-fit/job-fit-detail-page.tsx`) shows match scores + study topics, but candidate has zero signal about the company beyond the bare `company: string` on the Job record. Before clicking Apply, user needs: company facts (size, industry, location, website), public sentiment summary, and external rating proof. Manual googling per job kills funnel — must surface in-app.

## Scope

**IN**
- New first-class `Company` entity (separate from Job, lookup by `companyId`)
- Tier 1: scrape company section from job source page (ITviec, TopCV, VNW, VL24H), 90d TTL auto-refetch
- Tier 2: lazy LLM grounded enrichment (Gemini + web search) on first detail open per company per 30 days
- External ratings inline (Glassdoor + Google score + review count), 7d cache, admin manual refresh
- LLM name-resolution dedup: ≥0.95 auto-merge, 0.7-0.95 admin queue, <0.7 create new
- Company card on Job Fit detail page (progressive render: instant facts → async enrichment → ratings)
- Admin tooling: dedup queue, manual refetch endpoints

**OUT**
- Own UGC reviews (deferred to Phase 08, post-pilot)
- Glassdoor/Indeed full review scraping (link out + score only, no review body)
- Company logo CDN pipeline (use source URL directly at pilot scale)
- Vertical enum changes (Company has its own `industry` field, independent of Job.vertical)
- Postgres migration (Phase 08, post-pilot)

## Stack

Pilot KV (Upstash) namespace conventions matching existing job pattern:
- `co:{slug}` → Company JSON
- `co-alias:{normalized-name}` → slug (resolver index)
- `co-ratings:{slug}` → ExternalRatings JSON (7d TTL)
- `co-enrich-calls:{YYYY-MM}` → counter (abuse guard, mirrors usage tracking)

Re-use existing infra: `src/lib/scrape/fetch-html.ts`, `extract-readability.ts`, `detect-antibot.ts`. New scrape modules per source under `src/lib/scrape/companies/`. Gemini grounded-search via existing LLM client. UI cards in `src/features/job-fit/`.

Post-pilot mapping (Phase 08) — KV → Postgres 1:1:
- `companies`, `company_aliases`, `company_enrichments`, `company_external_ratings`, `company_dedup_queue` tables

## Architectural Decisions

1. **Company is first-class entity, not Job field.** Multiple jobs share one company; enrichment cost amortizes per-company not per-job. Decoupling keeps Job shape stable.
2. **Job carries optional `companyId` plus existing `company: string`** for backward compat — no KV migration needed for 150 live jobs.
3. **Three-tier data, three storage cadences.** Tier 1 scrape (90d TTL) at-ingest; Tier 2 LLM enrichment (30d TTL) lazy per-detail-open; Tier 3 external ratings (7d TTL) lazy per-detail-open. Different freshness needs, different cost profiles, isolated cache buckets.
4. **Lazy enrichment over batch.** Only fire LLM enrichment when a user actually opens a job detail — prevents paying $$ for companies nobody clicks. Cache key per-company means second viewer pays $0.
5. **Conservative LLM dedup (≥0.95 auto).** False-merge cost > false-split cost — merging FPT Software with FPT Telecom incorrectly poisons two companies' enrichment. Admin queue absorbs 0.7-0.95 grey zone.
6. **Insufficient-source guard.** If LLM grounded search returns <2 sources for a `cons` claim, render only `summary` + `pros`. Hard rule, not config — defamation mitigation per security review.
7. **Citations mandatory + neutral phrasing.** Every enrichment claim attributed ("Theo X, …"), citation chips rendered inline. Disclaimer text fixed: "Tổng hợp từ nguồn công khai, không phản ánh quan điểm của [platform]".

## Data Flow

```
Ingest path (Tier 1):
  scrape job detail → JobPosting parse
                    ↓
  extract company name + normalize (lowercase, strip "Cty/Co.,Ltd/JSC/TNHH")
                    ↓
  alias lookup co-alias:{normalized}
   ┌─ hit  → reuse existing slug, attach companyId to Job, done
   └─ miss → LLM dedup search (top-3 candidates by name similarity)
              ┌─ best ≥ 0.95 → auto-merge, update co-alias index
              ├─ 0.7 ≤ best < 0.95 → push to dedup queue, attach companyId of best (provisional)
              └─ best < 0.7 → mint new slug, scrape company section page, save co:{slug}
                                ↓
                              schedule expiresAt = now + 90d

User detail-open path (Tier 2 + Tier 3, lazy):
  GET /api/companies/[slug]
   ↓
  load co:{slug} (Tier 1, always present)
   ↓
  parallel:
    ├─ if co.enrichment expired/missing → Gemini grounded search → cache 30d
    └─ if co-ratings:{slug} expired/missing → Glassdoor + Google scrape → cache 7d
   ↓
  return merged Company shape to client
   ↓
  UI: render Tier 1 instant, swap in Tier 2 + Tier 3 when ready (Suspense pattern)
```

Failure modes:
- LLM ground <2 sources → cache `{ enrichment: { summary, pros, cons: [], insufficientSources: true } }` 7d TTL
- Glassdoor/Google rate-limit → cache `{ ratings: null, retryAfter: 7d }`
- Scrape company page fail at ingest → mint stub `co:{slug}` with name only, mark `tier1Pending: true`, retry on next ingest run
- All errors surface per [[feedback_error_surfacing_no_silent_fallback]] — only 404 silent

## Phases

| # | File | Effort | Focus |
|---|------|--------|-------|
| 1 | phase-01-company-entity.md | 2-3h | `lib/companies/types.ts`, KV namespace, alias resolver, normalize util, unit tests |
| 2 | phase-02-ingest-tier1-scrape.md | 2-3h | Per-source company-page scrapers, hook into ingest pipeline, 90d TTL refetch, stub-on-fail |
| 3 | phase-03-external-ratings.md | 2-3h | Glassdoor + Google scrape, 7d cache, admin refetch endpoint, ToS-safe link-out UI contract |
| 4 | phase-04-ui-company-card.md | 2-3h | Company card on Job Fit detail (right rail desktop / collapsible mobile), Tier 1 + ratings instant render |
| 5 | phase-05-llm-enrichment.md | 2-3h | `/api/companies/[slug]` endpoint, Gemini grounded search, citation extraction, 30d cache, insufficient-source guard |
| 6 | phase-06-ui-enrichment-async.md | 1-2h | Lazy fetch enrichment on detail open, Suspense + skeleton, citation chips, disclaimer text |
| 7 | phase-07-admin-tooling.md | 2-3h | Admin dedup queue UI, manual merge/split actions, refetch endpoints (company / ratings / enrichment) |
| 8 | phase-08-postgres-ugc-deferred.md | post-pilot | Migration to Postgres (companies + aliases + enrichments + ratings + dedup_queue tables); UGC reviews schema; moderation framework. Blocked on auth maturity + ≥1K users per [[project_post_pilot_db_migration]] |

**Sequencing:** Phase 1 blocks all. Phase 2 + Phase 3 parallel after 1 (different scrape targets, different KV keys). Phase 4 needs 1 + 2 + 3. Phase 5 needs 1. Phase 6 needs 4 + 5. Phase 7 needs 1-6 in place to have data to admin over. Phase 8 deferred.

## Hard Constraints

- [[feedback_filter_before_scrape]] — company-page scrape only triggers for companies surviving job-level filter; never broad-crawl company directories
- [[feedback_error_surfacing_no_silent_fallback]] — `/api/companies/[slug]` must surface 4xx/5xx; only 404 may silently fall back to "Chưa có thông tin"
- [[feedback_secrets_never_generated_in_chat]] — admin endpoints behind existing admin auth + DISABLE_SHARED_KEY flag, no per-feature key minting
- Defamation guard: LLM `cons` rendering blocked unless ≥2 grounded citations per item
- PII guard: enrichment may name public roles (CEO, founder); must not name non-public employees

## Top Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | LLM hallucinates negative claim that surfaces as `cons` → defamation exposure | Medium | High | Phase 5 insufficient-source guard (≥2 citations or hide); Phase 6 neutral phrasing template ("Theo X, …"); disclaimer text always rendered |
| 2 | Name-resolution false-merge (FPT Software + FPT Telecom collapsed) → enrichment polluted across companies | Medium | High | Conservative threshold 0.95; Phase 7 admin queue for 0.7-0.95 grey zone; rollback path = split via admin tool |
| 3 | Glassdoor anti-bot blocks rating scrape → Tier 3 always empty | High | Low | Phase 3 designs for graceful empty state; Google ratings as fallback; failure cached 7d to avoid hammer |
| 4 | LLM enrichment cost spikes (cache bust bug or abuse) | Low | Medium | `co-enrich-calls:{YYYY-MM}` counter + Pushover alert at 2× baseline; lazy-only firing (no batch) caps blast radius |
| 5 | Admin dedup queue grows unbounded (every new source = 0.7-0.95 candidates) | Medium | Medium | Phase 7 batches similar candidates; Phase 8 Postgres migration unblocks better similarity index |
| 6 | Company-page scrape per source breaks when site redesigns | Medium | Low | Per-source isolated module under `src/lib/scrape/companies/`; failure stubs Job's company without blocking ingest |

## Test Matrix

| Layer | Tested in | Method |
|-------|-----------|--------|
| Name normalize + alias resolve | Phase 1 | Vitest unit with 30+ VN company name variants ("FPT", "Cty FPT", "FPT Software JSC", …) |
| LLM dedup threshold behavior | Phase 1 | Mock LLM judge with known similarity scores; assert auto-merge / queue / mint branches |
| Per-source company scrape | Phase 2 | Fixture HTML per source (ITviec, TopCV, VNW, VL24H); assert extracted fields |
| External rating scrape robustness | Phase 3 | Fixture HTML + simulated 429/503; assert cache-on-fail behavior |
| Company card render states | Phase 4 + 6 | RTL: Tier 1 only / Tier 1 + Tier 2 / Tier 1 + Tier 3 / all-empty states |
| Enrichment endpoint cost guard | Phase 5 | Synthetic test: 10 concurrent opens for same company → 1 LLM call only (cache hit) |
| Admin dedup actions | Phase 7 | E2E: enqueue → merge → verify both aliases now point to one slug |

## Rollback Plan

- **Phase 1**: delete `lib/companies/` + KV keys (`KV.del 'co:*' 'co-alias:*'`); Job records untouched (companyId optional)
- **Phase 2**: revert ingest hook; existing scrape paths unchanged; orphan `co:*` entries harmless
- **Phase 3**: revert ratings scrape module + admin endpoint; UI degrades to "Đang cập nhật" placeholder
- **Phase 4**: revert detail-page UI change; data still accrues in KV for later re-enable
- **Phase 5**: revert `/api/companies/[slug]` enrichment branch; endpoint returns Tier 1 only
- **Phase 6**: revert async UI; card shows Tier 1 + ratings (already proven in Phase 4)
- **Phase 7**: revert admin UI; dedup queue grows untouched until re-enabled
- **Phase 8**: deferred — separate plan, separate rollback

## File Ownership

- Phase 1: `src/lib/companies/types.ts`, `src/lib/companies/normalize.ts`, `src/lib/companies/alias-resolver.ts`, `src/lib/companies/kv-client.ts`, tests
- Phase 2: `src/lib/scrape/companies/{itviec,topcv,vnw,vl24h}-company.ts` (new), ingest hook in `scripts/ingest-jobs.ts`
- Phase 3: `src/lib/scrape/external-ratings/{glassdoor,google}.ts` (new), `src/app/api/admin/companies/[slug]/refetch-ratings/route.ts`
- Phase 4: `src/features/job-fit/company-card.tsx` (new), edit `job-fit-detail-page.tsx`
- Phase 5: `src/app/api/companies/[slug]/route.ts` (new), `src/lib/companies/enrichment.ts` (new)
- Phase 6: `src/features/job-fit/company-card-enrichment.tsx` (new), edit `company-card.tsx` for Suspense boundary
- Phase 7: `src/app/(app)/admin/companies/page.tsx` (new), `src/app/api/admin/companies/dedup-queue/route.ts` (new)

## Success Metrics

- ≥90% of currently-active jobs (150+) have `companyId` attached within 2 days post-deploy
- Company card render p95 ≤ 200ms (Tier 1 instant) on Job Fit detail
- LLM enrichment p95 ≤ 8s on first open; cache-hit p95 ≤ 50ms
- LLM enrichment monthly cost ≤ $20 ceiling at current job pool size
- Admin dedup queue ≤ 20 pending items at any time (Phase 7 throughput target)
- Zero defamation-classified content in 50-card manual audit (Phase 6 acceptance)
- Click-through on Apply CTA does not drop ≥5% vs pre-feature baseline (no harm metric)

## Cross-Plan Coordination

- **[[project_post_pilot_db_migration]]**: Phase 8 of this plan is the company-domain slice of that migration. Add companies + aliases + enrichments + ratings + dedup_queue tables to its schema scope.
- **`260603-1655-ingest-taxonomy`**: Phase 2 of this plan hooks into the per-source scrape modules taxonomy creates. Coordinate: that plan owns scrape orchestration; this plan owns company-page extraction inside each source module.
- **Pilot reopen runbook** (docs/deployment.md §17): runs in parallel today per user directive. No file conflicts — different code paths (auth flag vs feature code).

## Open Questions (carry to user)

1. **Phase 8 trigger condition**: lock as "pilot exit OR ≥1K users OR ≥500 unique companies in KV" — which threshold actually fires migration? Default: whichever hits first.
2. **Logo handling at pilot scale**: Tier 1 stores source URL (e.g. ITviec's CDN). If source returns 403 to our domain, fallback strategy = scrape + self-host (S3/Blob) or just hide logo? Default: hide, defer self-host to Phase 8.
3. **Sister-company policy**: when admin merges "FPT Software" + "FPT Telecom" review queue → keep as separate companies (current default) or model as parent-child? Default: separate (simpler), revisit if conglomerates dominate the data.
4. **Cron-driven Tier 1 refresh vs lazy**: current plan = check 90d expiry at-detail-open. Alternative = nightly cron pre-refreshes top-N most-viewed companies. Default: lazy until Phase 7 data shows clear pareto.
