# Phase 05 — Vercel Cron + i18n VI/EN Keys

## Context Links
- Memory: `project_cvmatching_2026_06_10_state` — i18n in-house harness covers 8 surfaces; this is surface #9
- Memory: `feedback_ui_ux_design_system` — never leak prompt/AI text into UI strings; i18n keys must be human-curated
- Memory: `feedback_single_env_production_only` — one Vercel environment; cron secret shared across all envs
- Related files: `cv-ex-refactor/vercel.json`, `cv-ex-refactor/src/lib/i18n/messages.ts`, `cv-ex-refactor/src/lib/i18n/use-t.ts`

## Overview
- **Priority:** P2 (must ship SAME release as Phase 04 — no English-only deploy)
- **Status:** pending
- **Description:** Add Vercel daily cron entry for abandon sweep + author full VI/EN i18n key set for the interview namespace. Cron handler already exists from Phase 03; this phase wires the schedule.

## Key Insights
- Cron runs daily 02:00 UTC = 09:00 ICT (low-traffic morning window).
- i18n keys are author-written, NOT pulled from LLM output (those go into JSONB and render verbatim from LLM's locale-conditioned content).
- Keys cover: nav label, mode select labels, form labels, button states, Dual Lens quadrant titles, question type labels (behavioral/technical/scenario), grade pill labels (0/1/2/3), error toasts (402/409/503), history widget headings.
- Single-environment production — cron secret in `CRON_SECRET` env via Vercel dashboard.

## Requirements
**Functional:**
- Cron handler `POST /api/cron/interview-abandon` runs daily 02:00 UTC.
- All UI strings in Phase 04 components resolved via `useT('interview.*')`.
- Both VI and EN locales complete (no missing-key fallbacks visible).

**Non-functional:**
- Cron secret never logged.
- i18n keys grouped under single `interview` namespace.
- Phase 06 e2e MUST verify locale switching changes UI strings (not LLM content).

## Architecture
```
vercel.json
  └─ crons: [{ path: '/api/cron/interview-abandon', schedule: '0 2 * * *' }]

POST /api/cron/interview-abandon  (already authored in Phase 03)
  ├─ verify x-vercel-cron + CRON_SECRET
  └─ markAbandoned() → UPDATE WHERE status='in_progress' AND created_at < now() - '24h'

messages.ts
  └─ interview: {
       nav, landing.*, modeSelect.*, rolePicker.*, providerSelect.*,
       start.*, dualLens.*, question.*, submit.*, results.*, history.*,
       errors.byokMissing, errors.resumeExisting, errors.providerDown, errors.badOutput,
       grade.score0..3
     }
```

## Related Code Files
**Modify:**
- `cv-ex-refactor/vercel.json` — append crons entry
- `cv-ex-refactor/src/lib/i18n/messages.ts` — add `interview` namespace VI + EN
- Possibly `cv-ex-refactor/src/lib/i18n/types.ts` if keys are typed

**Create:** none in this phase (cron handler already created in Phase 03)
**Delete:** none

## Implementation Steps
1. Read current `vercel.json` to see existing cron entries / region settings.
2. Append cron entry:
   ```json
   {
     "path": "/api/cron/interview-abandon",
     "schedule": "0 2 * * *"
   }
   ```
3. Confirm `CRON_SECRET` is already in Vercel env (existing cron uses it — should be).
4. Author `interview.*` keys in `messages.ts`. Both VI and EN. Sketch of key set:
   - `interview.nav.label` — "Interview Practice" / "Luyện phỏng vấn"
   - `interview.landing.title`, `interview.landing.subtitle`
   - `interview.modeSelect.jobFit`, `interview.modeSelect.standalone`
   - `interview.rolePicker.targetRole`, `interview.rolePicker.anchorRole`, `interview.rolePicker.anchorHelp`
   - `interview.providerSelect.label`, `interview.providerSelect.gemini|openai|anthropic`
   - `interview.start.button`, `interview.start.loading`
   - `interview.dualLens.recruiterHire`, `interview.dualLens.recruiterNoHire`, `interview.dualLens.candidateHire`, `interview.dualLens.candidateNoHire`
   - `interview.dualLens.reasons`, `interview.dualLens.signals`, `interview.dualLens.gaps`, `interview.dualLens.opportunities`, `interview.dualLens.growth`, `interview.dualLens.risks`, `interview.dualLens.mismatches`
   - `interview.question.behavioral`, `interview.question.technical`, `interview.question.scenario`
   - `interview.question.placeholder`, `interview.question.charCount` (with `{count}/{max}` params)
   - `interview.submit.button`, `interview.submit.loading`, `interview.submit.disabledHelp`
   - `interview.results.overallScore`, `interview.results.gradeFeedback`, `interview.results.improvements`
   - `interview.history.title`, `interview.history.empty`, `interview.history.viewResults`
   - `interview.errors.byokMissing.title`, `interview.errors.byokMissing.body`, `interview.errors.byokMissing.cta`
   - `interview.errors.resumeExisting`
   - `interview.errors.providerDown`
   - `interview.errors.badOutput`
   - `interview.errors.sessionExpired`
   - `interview.grade.score0`, `interview.grade.score1`, `interview.grade.score2`, `interview.grade.score3` (Fail / Weak / Solid / Excellent)
5. Cross-reference Phase 04 component code: grep `useT('interview.*` and verify every key is defined.
6. If `i18n/types.ts` has typed keys, extend the type union.
7. Run `pnpm tsc --noEmit` to catch missing key references.
8. Manual locale switch test: VI → EN → VI; verify all strings change.

## Todo List
- [ ] Append cron entry to vercel.json
- [ ] Confirm CRON_SECRET present in Vercel env
- [ ] Author all VI keys in messages.ts (interview namespace)
- [ ] Author all EN keys in messages.ts (interview namespace)
- [ ] Cross-grep components for unused/missing keys
- [ ] Update i18n types union if applicable
- [ ] tsc green
- [ ] Manual locale switch smoke

## Success Criteria
- After deploy, hitting Vercel cron logs shows daily 02:00 UTC invocation with `{ updated: N }` response.
- Switching VI ↔ EN in UI changes every Interview Practice surface string.
- No raw key (e.g. `interview.nav.label`) visible in UI.
- 24h-old in-progress session is flipped to `abandoned` after next cron run.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cron not firing (wrong schedule syntax) | L | M | Verify in Vercel dashboard cron list after deploy; manual `curl` first |
| Missing key → English fallback shown in VI UI | M | L | Cross-grep step in implementation; tsc-typed keys catches at compile |
| LLM emits English when locale=VI | M | M | Phase 02 prompt locale instruction handles; Phase 06 manual e2e verifies |
| Cron secret accidentally committed | L | H | `.env*` gitignored; secret only in Vercel dashboard |
| Abandon sweep too aggressive — flips sessions user is actively answering | L | M | 24h is generous; document threshold in handler comment |

## Security Considerations
- Cron secret in env, never logged.
- Cron handler header check rejects unauthenticated calls (returns 401).
- No PII in i18n keys (they're static templates).

## Next Steps
- Phase 06 includes cron handler unit test + i18n smoke as part of test suite.
- Post-launch: monitor Vercel cron logs for 1 week; tune threshold if abandon count surprises.
