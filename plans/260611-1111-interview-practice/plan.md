---
title: "Dual Lens + Interview Practice (v1 BYOK)"
description: "New post-Job Fit surface — Dual Lens 4-quadrant analysis + 10 medium-hard Q with batched grading"
status: pending
priority: P2
effort: 10-16h
branch: main
tags: [feature, interview, llm, byok, dual-lens]
created: 2026-06-11
---

# Plan — Dual Lens + Interview Practice

**One-liner:** After Job Fit chevron, user picks target job (Job Fit / applied / standalone role title) + CV anchor role → LLM emits Dual Lens (4 quadrants Recruiter Hire/No-hire × Candidate Hire/No-hire) + 10 medium-hard interview Q (4 behavioral, 4 technical, 2 scenario) with rubrics → user answers → batched LLM grade → in-app results.

**Status:** ALL 6 PHASES SHIPPED 2026-06-12 — ready for prod test
**Target start:** 2026-06-12 (pulled forward — operator said tiếp tục phát triển)
**Pricing tier v1:** BYOK only (Gemini / OpenAI / Anthropic key in Settings). Billing+credits deferred.
**LLM calls/session:** exactly 2 (`interview_gen` + `interview_grade`).

## Phases

| # | File | Status | Description | Est. |
|---|---|---|---|---|
| 01 | [phase-01-db-migrations-and-applied-jobs.md](./phase-01-db-migrations-and-applied-jobs.md) | [x] done 2026-06-12 | Drizzle migrations 001+002, `applied_jobs` table, `/api/jobs/apply` route, Apply-button wire-up, UsageAction enum extension | 1-2h |
| 02 | [phase-02-llm-prompts.md](./phase-02-llm-prompts.md) | [x] done 2026-06-12 | `prompt-interview-gen.ts` + `prompt-interview-grade.ts` + Zod schemas, provider-agnostic via existing `callLLM` / `callLLMWithFallback` | 2-3h |
| 03 | [phase-03-api-routes.md](./phase-03-api-routes.md) | [x] done 2026-06-12 | 5 API routes (start, submit, [id], history, cron). BYOK gating, unique constraint check, 402/409/503 classification | 2-3h |
| 04 | [phase-04-ui-components.md](./phase-04-ui-components.md) | [x] done 2026-06-12 | Mode select, role picker, question card, results page, dashboard widget. Stable JSX tree | 3-4h |
| 05 | [phase-05-cron-and-i18n.md](./phase-05-cron-and-i18n.md) | [x] done 2026-06-12 | Vercel cron entry, abandon-sweep handler, i18n VI/EN keys wired SAME phase | 1-2h |
| 06 | [phase-06-tests-and-e2e.md](./phase-06-tests-and-e2e.md) | [x] done 2026-06-12 | Unit + integration tests, manual E2E checklist, delegate to tester agent | 1-2h |

## Key Dependencies
- Existing `callLLMWithFallback` chain (gemini → openai → anthropic) — extend pattern from analyze/recommend
- Drizzle ORM + Postgres (current setup)
- NextAuth v5 JWT — `ensureUserRow()` before every FK insert
- i18n harness `useT()` + `messages.ts`
- Settings page BYOK key storage (already shipped)

## Out of Scope (v2 candidates)
- Refined CV anchor (v1 uses CV original roles only; refined CV deferred — sessionStorage ephemeral)
- Paste-external-JD in standalone mode (v1 = role title only)
- Voice answers, audio transcription
- PDF export, share links
- Multiple attempts per (user, job/role, anchor) — v1 = 1, no re-roll
- Billing/credits integration (BYOK-only this version)

## Success Criteria
- BYOK user completes 1 session end-to-end (start → 10 answers → submit → results visible)
- Results persist to `interview_sessions` JSONB
- 24h abandon cron flips `in_progress` → `abandoned` and unblocks re-attempt
- No auto-LLM calls — both calls fire only on explicit user button click
- BYOK missing/invalid → 402 with actionable error, NO silent heuristic fallback
- VI + EN i18n keys live SAME deploy
- All Phase 06 tests green
