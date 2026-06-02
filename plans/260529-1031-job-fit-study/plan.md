---
title: "v0.3 Job Fit & Study"
description: "Recommend 5-10 VN jobs + per-job study topics after refined-cv, with redirect tracking and cost guard"
status: pending
priority: P1
effort: 7-8d
branch: main
tags: [feature, v0.3, jobs, embedding, llm, vn]
created: 2026-05-29
---

# v0.3 Job Fit & Study — Plan Overview

Single-call LLM pipeline that takes a refined CV + 150 seed jobs (KV-indexed Gemini embeddings) → returns 5-10 jobs with 9-dim scores, matchReasons, and 5-10 study topics each. Quiz dropped. Taxonomy dropped. Spec is final.

**Source spec:** `plans/reports/spec-260529-1031-job-fit-study.md` (read first — overrides any older brainstorm).

## Goals
- After `/refined-cv`, propose 5-10 jobs >80 overall score + curated study topics per job.
- Track external apply clicks via `/api/r/[jobId]` redirect.
- Stay within $1/day @ 200 users; $3 kill-switch.
- KV-only (no Postgres). Manual paste seed (no scraper).

## Phases

| # | Phase | Status | Effort | File |
|---|---|---|---|---|
| 0 | Hardening (admin gate, HMAC, cost guard, middleware excludes) | pending | 1-1.5d | [phase-00-hardening.md](./phase-00-hardening.md) |
| 1 | Ingest CLI + 150 seed jobs + chunked embedding blob | pending | 1.5-2d | [phase-01-ingest-cli-and-seed.md](./phase-01-ingest-cli-and-seed.md) |
| 2 | `/api/jobs/recommend` + single LLM batch + score lib + cache | pending | 1.5d | [phase-02-recommend-endpoint.md](./phase-02-recommend-endpoint.md) |
| 3 | `/job-fit` list + `/job-fit/[jobId]` detail + sidebar nav + CTA | pending | 1.5-2d | [phase-03-ui-job-fit.md](./phase-03-ui-job-fit.md) |
| 4 | Cron refresh + redirect tracking + feedback + cost-guard wiring + admin | pending | 1d | [phase-04-refresh-feedback-tracking.md](./phase-04-refresh-feedback-tracking.md) |
| 5 | Tests + privacy.md + deployment.md + smoke deploy | pending | 0.5d | [phase-05-testing-docs-deploy.md](./phase-05-testing-docs-deploy.md) |

## Dependency graph

```
0  ──►  1  ──►  2  ──►  3  ──►  4  ──►  5
                       └────────►  4 (in parallel files: UI vs cron/redirect)
```

Phase 0 **blocks all others** (admin gate, HMAC secret, drop reason field, middleware excludes, cost guard skeleton).
Phase 4 admin-dashboard subtask depends on Phase 2 metrics keys being live.

## File-ownership boundaries (no two phases edit same file)
- Phase 0: env, `proxy.ts` (modify — add exclude matcher to existing v0.2 visit-counter), `lib/cost/guard.ts` (new), `consume-quota.ts` (add bucket only), `lib/usage/admin-auth.ts` (audit only)
- Phase 1: `scripts/ingest-jobs.ts`, `data/seed-jobs.json`, `lib/jobs/{types,repo,embed,classify}.ts`
- Phase 2: `lib/jobs/score.ts`, `lib/llm/prompt-job-recommend.ts`, `lib/llm/normalize-job-recommend.ts`, `app/api/jobs/recommend/route.ts`
- Phase 3: `app/(app)/job-fit/**`, `components/job-card.tsx`, `components/job-detail.tsx`, `components/topic-chip.tsx`, `dashboard-sidebar.tsx`, `refined-cv/refined-cv-page.tsx` (CTA only)
- Phase 4: `app/api/jobs/refresh/route.ts`, `app/api/r/[jobId]/route.ts`, `app/api/topics/feedback/route.ts`, `vercel.ts` (new TS config), `admin/usage/route.ts` + page surface
- Phase 5: tests under `tests/`, `docs/privacy.md`, `docs/deployment.md`, `docs/project-changelog.md`

## Rollback strategy (per phase)
- Phase 0: env vars guarded (defaults safe); middleware exclude is additive. Revert = remove env + delete `cost/guard.ts`.
- Phase 1: CLI is non-runtime; revert = drop `data/seed-jobs.json` + KV keys (`jobs:*`, `job:*`, `embeddings:active:v*`).
- Phase 2: route is new; revert = delete route + `lib/jobs/score.ts`.
- Phase 3: feature-flagged via sidebar nav + CTA presence. Revert = remove CTA + nav item; pages return 404.
- Phase 4: cron disable in `vercel.ts` (remove crons array entry); redirect route can be deleted; UI silently uses sourceUrl fallback.
- Phase 5: docs/tests only, no runtime impact.

## Backward compatibility
- New routes only; no breaking changes to `/api/analyze`, `/api/career-path`.
- Quota: additive bucket (`job-recommend`); existing buckets untouched.
- `proxy.ts` **already exists** from v0.2 (visit counter) — Phase 0 adds matcher excludes only, no new file.
- `vercel.ts` is **new** (TypeScript config preferred per Vercel knowledge update) — replaces deprecated `vercel.json` pattern. Requires `@vercel/config` install in Phase 4.
- Sidebar nav: append, do not reorder existing items.

## Success criteria (whole feature)
- All 5 phases shipped, smoke test passes on prod URL.
- 150 jobs indexed, embeddings:active:v1 blob loaded in <200ms cold.
- `/api/jobs/recommend` p95 < 8s, returns ≥3 jobs >80 for a realistic CV.
- Redirect `/api/r/[jobId]` 302s with metric incremented.
- Cost guard fires alert at $1 warn / $3 kill on synthetic load.
- `docs/privacy.md` published, ADMIN_USER_IDS set in prod.

## Open questions
None — locked per spec.
