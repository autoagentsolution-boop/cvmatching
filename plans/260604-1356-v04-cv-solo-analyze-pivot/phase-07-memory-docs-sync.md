# Phase 7 — Memory + Docs Sync

**Effort:** 30 min
**Owner:** lead
**Status:** pending
**Blocked by:** phases 1-6
**Blocks:** none

## Goal

Update memory entries to reflect the shipped pivot. Sync `docs/system-architecture.md` analyze + cover-letter sections. Delete deprecated v2 code paths if Phase 3 + 5 left them flagged. This phase runs **only after the pivot is verified in prod (or preview at minimum) and no rollback is pending.**

## Memory Updates

### [[feedback_scoring_ux_model]]

- Body: rescope "CV-vs-JD per-dim match" → "CV-intrinsic per-dim quality vs user-claimed role"
- Remove the v0.4-forward forward-reference (now current state)
- Update description field
- Keep mechanics paragraph (slider editable, overallScore recompute, frozen artifacts) IDENTICAL — only the meaning changed

### [[project_cvmatching_v01_state]]

- Bump to v0.4
- Document CV-solo analyze + must-have-relocated + cover-letter-rewired changes
- Remove "tomorrow's task = run runbook" line (pilot reopen pending separate session)
- Add new "current state" summary covering v0.4 funnel

### [[project_v04_pivot_cv_solo_analyze]]

- Add "Shipped" header at top with date + commit hashes
- Move "Decisions locked" to "Decisions implemented"
- Note any deviation from original plan (effort actual vs estimated, scope changes during impl)

### [[feedback_prompt_engineering_discipline]]

- No change (principles still apply)

### [[feedback_filter_before_scrape]]

- No change

### [[project_post_pilot_db_migration]]

- No change (pivot doesn't affect DB migration timing)

## Docs Updates

### `docs/system-architecture.md`

Sections to update:
1. **Analyze flow** — replace CV-vs-JD diagram with CV-solo + role-infer 2-stage diagram
2. **Cover Letter flow** — new entry: triggered from Job Fit detail with jobId, server fetches Job from KV
3. **Quota table** — confirm 5/day analyze unchanged
4. **Cache schema** — note `analyze:v3` is current; v2 deprecated with banner-driven migration
5. **Funnel diagram** — update from JD-paste-required to CV-only first-touch

### `docs/development-roadmap.md`

- Mark v0.4 milestone complete
- Update Phase entries (analyze pivot → done)
- Queue pilot reopen runbook as next milestone

### `docs/project-changelog.md`

```markdown
## v0.4.0 — 2026-06-XX

### Pivot: CV-Solo Analyze
- `/analyze` no longer requires JD input
- LLM infers target role from CV; confirm modal when low-confidence
- 9-dim scoring rescoped to CV-intrinsic per-dim quality (mechanics identical)
- Must-have requirements moved from `/analyze` to Job Fit detail page
- Cover Letter generation triggered from Job Fit detail (no standalone JD form)
- sessionStorage `analyze:v2` → `analyze:v3`; banner prompts user-driven re-analyze
- Quota unchanged (5/day analyze, 3/day cover letter)

### Migration notes
- Existing v2 cache users see "Ứng dụng đã cập nhật" banner on next visit
- Old `/cover-letter` route redirects to `/job-fit`
- API `/api/analyze` no longer accepts `jdText`; `/api/cover-letter` switches to `{ jobId, cvText }`
```

## Code Cleanup

- Delete `src/lib/llm/prompt-analyze.ts` (v2 prompt) — Phase 1 kept it alongside; now safe to remove
- Delete `src/lib/llm/normalize-analyze.ts` (v2 normalizer)
- Delete `src/features/cover-letter/standalone-form.tsx` + related (if Phase 5 only flagged, now hard-remove)
- Search for any remaining references to `jdText` in code; remove or document deprecation
- Search for any UI components still rendering CV-vs-JD copy

## Implementation Steps

1. Update `feedback_scoring_ux_model.md` body. Run grep on repo for any UI strings referencing "vs JD" — fix or delete.
2. Update `project_cvmatching_v01_state.md` to v0.4 state.
3. Add "Shipped" header to `project_v04_pivot_cv_solo_analyze.md`.
4. Edit `docs/system-architecture.md` sections per list.
5. Append v0.4 entry to `docs/project-changelog.md`.
6. Mark roadmap milestone.
7. Run dead-code grep: `git grep -i 'jdtext\|jd_text\|cv-vs-jd'` — clean up.
8. Final tsc + vitest pass.
9. Git commit single PR: `chore(docs): sync memory + docs for v0.4 pivot ship`.

## Acceptance Criteria

- [ ] All 3 memory entries reflect shipped state
- [ ] `docs/system-architecture.md` updated (5 sections)
- [ ] Changelog v0.4 entry added
- [ ] Roadmap milestone marked
- [ ] Zero `jdText`/`jd_text` references in src/
- [ ] Zero v2 prompt/normalizer files in src/
- [ ] tsc clean
- [ ] All tests pass

## Risks

- **Memory entry drift over time**: future sessions may not catch all stale references. Mitigation: this phase explicitly grep + clean; flag any leftover for follow-up.
- **Docs lag behind code**: changelog often forgotten. Mitigation: this phase is part of the pivot acceptance — pivot is NOT shipped without docs sync.

## Security

- No security implications (docs + memory updates only)

## Next Phase

None — pivot complete. Unblocks:
- Pilot reopen runbook execution
- Phase 4 wipe + re-ingest (taxonomy plan)
- Hybrid refresh top-up R1-R7
- Company-reviews implementation
- UI polish
- Future auto-pipeline G (email digest)
