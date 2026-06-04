---
name: v04-cv-solo-analyze-pivot
title: v0.4 — CV-Solo Analyze + Cover Letter Rewire
status: pending
created: 2026-06-04
owner: vinh2000ld11@gmail.com
blockedBy: []
blocks: [pilot-reopen-runbook]
related: [project_v04_pivot_cv_solo_analyze, 260604-1218-company-profile-reviews, 260603-1655-ingest-taxonomy]
effort: 10-14h (active phases 1-7; 2-3 day push)
---

# v0.4 — CV-Solo Analyze + Cover Letter Rewire

## Status

Pending — strategic pivot captured via /btw fork 2026-06-04, 6 decisions locked. Plan + phase files ready; implementation queued AHEAD of pilot reopen per decision #6.

## Problem

Current `/analyze` requires both CV + JD paste, scores CV-vs-JD match per-dimension. Activation friction is high: users must hunt a JD before getting any value. Funnel narrows to active applicants only. Target audience (candidate / HR / headhunter / passive job-seekers) is 5-10× larger than active applicants; most want CV-health feedback before they have a target job.

Cover Letter currently has its own standalone JD-paste form, duplicating the JD ingestion surface and creating two competing onboarding flows.

Must-have requirements live on `/analyze` even though they only make sense paired with a specific job — they should live in Job Fit detail.

## Scope

**IN**
- Drop JD input from `/analyze` entirely (page, API, prompt, types)
- LLM infers target role from CV (header/summary/title-claims) with confirmation UI when low-confidence
- 9-dim scoring rescoped to CV-intrinsic per-dim quality vs. inferred role (mechanics unchanged: sliders editable, overallScore recompute client-side, frozen artifacts)
- Strong points / weak points / presentation issues / real-experience gaps render in Optimization + Recommendations (reuse existing UI shells)
- Keyword extraction logic retained, JD cross-reference dropped
- Must-have requirements UI block moves from `/analyze` → `job-fit-detail-page.tsx`, scoped per-job
- Cover Letter generation entry point moves from standalone form → "Generate Cover Letter" CTA on Job Fit detail (uses job data + CV already in store)
- sessionStorage cache version bump + "app updated, re-analyze?" banner (user-driven, no auto-burn quota)
- 9-dim scoring prompt rewrite with CV-solo rubric per dimension
- Memory entry updates ([[feedback_scoring_ux_model]], [[project_cvmatching_v01_state]])

**OUT**
- Quota recalibration (decision #2: stay 5/day)
- Paid tier introduction (decision #3: quota-only paywall, defer)
- Auto-pipeline (cron scoring + email digest) — deferred to post-pivot
- Onboarding for "desired role" (auto-pipeline prereq) — deferred
- Refined CV, Career Path, Job Fit list, ingest, admin, auth — unchanged

## Stack

Existing routes + components rewired:
- `src/app/api/analyze/route.ts` — drop JD param, role-infer step, new prompt
- `src/features/analyze/page.tsx` + sub-components — strip JD textarea + must-have inline, add role-confirmation modal
- `src/features/job-fit/job-fit-detail-page.tsx` — host must-have UI block + Cover Letter CTA
- `src/lib/llm/prompt-analyze.ts` — new CV-solo 9-dim rubric prompt
- `src/lib/llm/normalize-analyze.ts` — output shape adjustments (role inference field, dim semantics)
- `src/features/analyze/analysis-store.ts` — schema version bump, banner state
- `src/app/api/cover-letter/route.ts` — accept jobId + CV instead of JD paste
- `src/features/cover-letter/*` — relocate entry point, drop standalone JD form (or hide behind feature flag for transition)

KV / quota / cost-guard / taxonomy / ingest unchanged.

## Architectural Decisions (locked via fork Q&A 2026-06-04)

1. **Role extraction** = LLM infer from CV header/summary + free-text title claims; confidence threshold dictates UX path:
   - High confidence → score immediately, role displayed at top with "Not your target? Override" link
   - Low confidence → modal showing top 3 candidate roles + free-text input BEFORE scoring fires; defaults to first candidate if user dismisses
2. **9-dim scoring rubric** rewritten — each dim now reflects how well the CV demonstrates that dimension for the claimed role:
   - skills: stack depth/breadth/modernity for the role
   - experience: narrative quality (impact, scope, progression, quantified results)
   - education: signaling quality + role fit
   - tools/domain/industry/seniority/location/soft: presentation strength + clarity
3. **Sliders + overallScore mechanics IDENTICAL** to v0.3 (per [[feedback_scoring_ux_model]] — only the semantic changes, not the UX). Frozen artifacts (recommendations / gaps / strengths / coverage / keywordCoverage / redFlags / suggestedSummaryLine) still from one LLM call.
4. **Must-have UI block** moved to Job Fit detail page. Existing data path: each Job has `mustHaves: string[]` populated at ingest. UI renders inline above match-reasons-block. Mobile collapsible default-open.
5. **Cover Letter** generation entry on Job Fit detail page. Click "Tạo Cover Letter" → uses CV from sessionStorage + Job data → calls `/api/cover-letter` with `{ jobId, cvText }`. Standalone JD-paste form removed (or hidden behind transition flag).
6. **Cache version bump** = `analyze:v3` (was v2). On app load, if old version detected, display banner "Ứng dụng đã cập nhật — Analyze lại để xem điểm theo cấu trúc mới?" with [Re-analyze] [Dismiss] actions. Do NOT auto-fire re-analyze (would burn quota silently).
7. **Quota stays 5/day** for analyze. CV-solo is cheaper LLM cost than CV-vs-JD; keep the cap generous to drive activation rather than tightening.
8. **No paid tier yet** — focus on user growth + free-tier quota as the throttle.
9. **Pivot ships BEFORE pilot reopen** — re-onboarding with legacy JD-comparison flow would lock the wrong activation funnel.

## Data Flow

```
User opens /analyze
  ↓
Pastes CV → click Analyze
  ↓
POST /api/analyze { cvText }                    ← no jd field
  ↓
Server:
  1. Role-infer LLM call: extract candidates + confidence from CV
  2a. If conf ≥ 0.75 → use top role, proceed to scoring
  2b. If conf < 0.75 → return { needsRoleConfirm: true, candidates: [...] }
  3. If confirmed: scoring LLM call with new CV-solo 9-dim rubric
  4. Return { role, scores, recommendations, gaps, ..., schemaVersion: 'v3' }
  ↓
Client:
  - If needsRoleConfirm → modal → user picks → POST again with { cvText, role: chosen }
  - Else store result in sessionStorage analyze:v3
  - Render dashboard

User opens Job Fit detail [jobId]
  ↓
Render existing match-reasons + study-topics + NEW must-have block + NEW Cover Letter CTA
  ↓
Click "Tạo Cover Letter" → POST /api/cover-letter { jobId, cvText } → markdown response
```

## Phases

| # | File | Effort | Focus |
|---|------|--------|-------|
| 1 | phase-01-scoring-prompt-rewrite.md | 2-3h | New CV-solo 9-dim rubric in `prompt-analyze.ts`; output schema adjustments; vitest fixtures comparing v2 vs v3 outputs on same CV |
| 2 | phase-02-api-analyze-refactor.md | 3-4h | Drop JD from route; add role-infer step (Gemini); 2-stage flow (infer → confirm? → score); return `schemaVersion: 'v3'` |
| 3 | phase-03-ui-analyze-restructure.md | 2-3h | Strip JD textarea + must-have inline; role-confirmation modal; banner-driven re-analyze flow; tests RTL state matrix |
| 4 | phase-04-must-have-to-job-fit.md | 1-2h | Move must-have UI block to `job-fit-detail-page.tsx`; ensure each Job in KV has `mustHaves[]` populated (verify ingest path) |
| 5 | phase-05-cover-letter-rewire.md | 1-2h | Cover Letter CTA on Job Fit detail; `/api/cover-letter` accepts `{ jobId, cvText }`; remove (or feature-flag) standalone JD form |
| 6 | phase-06-cache-version-bump.md | 1h | analyze:v2 → v3; banner UI; localStorage guard; migration path test |
| 7 | phase-07-memory-docs-sync.md | 30 min | Update [[feedback_scoring_ux_model]] body, [[project_cvmatching_v01_state]] state, `docs/system-architecture.md` analyze section |

**Sequencing**: Phase 1 (prompt) blocks Phase 2 (API uses prompt). Phase 2 blocks Phase 3 (UI calls API). Phase 4 + 5 parallel after Phase 1 (independent surfaces). Phase 6 needs Phases 2-5 done (cache shape stable). Phase 7 last.

## Hard Constraints

- [[feedback_scoring_ux_model]] — slider/recompute mechanics UNCHANGED; only what the score MEANS changes
- [[feedback_ui_ux_design_system]] — tokens + shared components; no leaked prompt/AI text in UI
- [[feedback_error_surfacing_no_silent_fallback]] — role-infer failure surfaces actionable error to user; never silent default
- [[feedback_prompt_engineering_discipline]] — diagnose raw LLM output FIRST before re-prompting if scoring quality regresses post-rewrite
- Quota stays 5/day per decision #2 (do not loosen during pivot)
- Cache version bump = USER-DRIVEN re-analyze only (banner; never auto-burn quota)

## Top Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | Role inference wrong on weak/missing CV header → user sees mis-categorized scores | High | High | Confidence threshold + confirm-modal for low-conf; persistent "Override role" link in result UI; log inference accuracy for tuning |
| 2 | New CV-solo prompt produces lower-quality output than v2 CV-vs-JD on same CV → user perceives regression | Medium | High | Phase 1 includes A/B fixtures with 10 sample CVs; manual review of v2 vs v3 outputs before ship |
| 3 | sessionStorage migration breaks active users mid-session → confusion | Medium | Low | Banner explicit + Re-analyze button; ALWAYS show v3 UI shell with empty state if cache mismatch; never display v2 data shape in v3 UI |
| 4 | Must-have data missing for older 150 jobs in KV → empty block on Job Fit detail | High | Low | Fallback "Chưa có must-have requirements" copy; backfill via separate one-off ingest pass if scope allows |
| 5 | Cover Letter usage drops if standalone form removed → adoption metric regression | Medium | Medium | Track CL-from-Job-Fit conversion vs prior baseline; if drop > 20% week-1, reconsider keeping form behind flag |
| 6 | Activation funnel doesn't lift post-pivot (hypothesis wrong) | Low | High | Track /analyze completion rate + bounce; if no lift in 2 weeks post-deploy, retro before committing more dev |

## Test Matrix

| Layer | Phase | Method |
|---|---|---|
| New scoring prompt produces valid 9-dim output | 1 | Vitest with 10 fixture CVs; Zod schema validation; manual review of summary + gaps quality |
| Role inference confidence calibration | 2 | 20 CV fixtures with known target roles; assert ≥85% top-1 accuracy at conf ≥ 0.75 |
| API 2-stage flow (infer → score) | 2 | E2E: low-conf CV → 200 with needsRoleConfirm; submit with role → 200 with full result |
| UI role-confirm modal | 3 | RTL: low-conf response → modal renders; pick candidate → API call; dismiss → defaults to first |
| Banner-driven re-analyze | 3 + 6 | RTL: old cache → banner shows; click Re-analyze → calls API + replaces cache |
| Must-have on Job Fit detail | 4 | RTL: job with mustHaves → block renders; job without → empty state |
| Cover Letter from Job Fit | 5 | RTL + API: click CTA → POST with jobId → markdown returned + rendered |
| sessionStorage version guard | 6 | Vitest: v2 shape → banner + no v3-shape render; v3 shape → no banner |
| Memory + docs accuracy | 7 | Manual review against shipped code |

## Rollback Plan

- **Phase 1**: revert prompt file; existing API still uses v2 prompt
- **Phase 2**: revert route; UI still pointing at v2 API → graceful degradation if v3 UI temporarily hits v2 schema
- **Phase 3**: revert UI; v2 page restored with JD textarea
- **Phase 4**: revert Job Fit detail edit; must-have inline on `/analyze` restored
- **Phase 5**: revert Cover Letter rewire; standalone form returns
- **Phase 6**: revert version bump; existing users keep v2 cache, no banner
- **Phase 7**: memory + docs are write-after-ship; revert via memory edit

Feature flag option for whole pivot: `NEXT_PUBLIC_V4_PIVOT_ENABLED` — gate `/analyze` page + API behavior so v2 and v3 can coexist during ramp.

## File Ownership

- Phase 1: `src/lib/llm/prompt-analyze.ts`, `src/lib/llm/normalize-analyze.ts`, `tests/prompt-analyze.test.ts`
- Phase 2: `src/app/api/analyze/route.ts`, `src/lib/llm/role-infer.ts` (new), `tests/api-analyze.test.ts`
- Phase 3: `src/features/analyze/*` (page + sub-components), `src/features/analyze/role-confirm-modal.tsx` (new)
- Phase 4: `src/features/job-fit/job-fit-detail-page.tsx`, `src/features/job-fit/must-have-block.tsx` (new, possibly moved from analyze)
- Phase 5: `src/app/api/cover-letter/route.ts`, `src/features/job-fit/cover-letter-button.tsx` (new), removal of `src/features/cover-letter/standalone-form.tsx`
- Phase 6: `src/features/analyze/analysis-store.ts`, `src/components/banners/re-analyze-banner.tsx` (new)
- Phase 7: memory dir (outside repo) + `docs/system-architecture.md`

## Success Metrics

- /analyze completion rate (paste → result rendered) up ≥ 15% vs v0.3.1 baseline (target: lift activation)
- /analyze → Job Fit click-through up ≥ 10% (target: cleaner funnel)
- Cover Letter generation rate per Job Fit view ≥ 5% (target: better than standalone form baseline)
- Role-inference top-1 accuracy ≥ 85% at confidence threshold ≥ 0.75 (Phase 2 test)
- No regression in `/analyze` p95 latency (CV-solo should be ≤ same as CV-vs-JD, often lower)
- Pre-pivot 5/day quota retention: ≥ 70% of pre-pivot DAUs return for ≥ 2nd analyze within 7 days (target: stickier with lower friction)

## Cross-Plan Coordination

- **Pilot reopen runbook** (docs/deployment.md §17) — gated BEHIND this pivot per decision #6. Update runbook step 4 (smoke) to include role-confirm modal verification once pivot ships.
- **`260604-1218-company-profile-reviews`** — implementation moves to post-pivot. Plan scaffold valid as-is.
- **`260603-1655-ingest-taxonomy`** — Phase 4 (wipe + re-ingest) deferred post-pivot; ensure ingest populates `Job.mustHaves[]` for Phase 4 must-have UI. Verify before pivot Phase 4 ships.
- **`260602-1739-hybrid-refresh-topup`** — independent, no conflict. Schedule post-pivot for daily-scoring auto-pipeline prereq.

## Open Questions (carry to user)

1. **Role inference confidence threshold**: locked at 0.75 default — too strict (more confirm-modals) or too lenient (more mis-classifications)? A/B fixture run in Phase 2 informs tuning.
2. **Cover Letter standalone form removal vs feature-flag transition**: hard-remove (clean) or flag-gated (safe rollback)? Default: hard-remove since Job Fit entry is the new canonical path.
3. **`mustHaves[]` backfill on 150 live jobs**: backfill all via one-off ingest pass, or accept empty state until next refresh cycle organic? Default: accept empty, organic.
4. **`schemaVersion` field strategy long-term**: per-feature version (analyze:v3, job-fit:v2) or app-wide version? Default: per-feature, simpler local invalidation.
