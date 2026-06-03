# Phase 5 — Polish + Smoke Test

**Day:** Sun 2026-06-08 | **Effort:** 2-3h | **Status:** Pending

## Goal

Full E2E flow validation, cost guard sanity, fix any UX regressions, commit + push.

## Steps

### E2E flow test

1. Login → /analyze with sample CV + JD → submit
   - ✅ Analysis result renders
   - ✅ Red Flag section visible (if any)
2. /refined-cv → submit refine
   - ✅ Red Flag banner top of page
   - ✅ Refined CV renders
   - ✅ "Generate Cover Letter" button at bottom
3. Click "Generate Cover Letter"
   - ✅ Markdown cover letter renders
   - ✅ Quota counter decrements
4. /jobs (or job-fit list)
   - ✅ Up to 10 jobs shown grouped/sorted by tier S→E
   - ✅ Each card shows tier badge
   - ✅ Action button per tier visible
   - ✅ Footer "Thêm jobs ngày mai" if < 10 jobs
5. Click "Apply" on S tier job
   - ✅ Navigate /refined-cv?jobId=...&mode=apply
   - ✅ Job context pre-loaded
   - ✅ Generate CV auto-triggered with apply mode prompt
6. Click "Quick Fix" on B tier
   - ✅ Mode=fill-gaps prompt variant
   - ✅ Output emphasizes gap-fill vs apply mode
7. Click "Improve" on C tier
   - ✅ Mode=stretch prompt variant
   - ✅ Output emphasizes growth narrative
8. Click "Roadmap" on D tier
   - ✅ /career-path?target=...&skillGaps=...
   - ✅ Form pre-filled
   - ✅ If existing roadmap: "Generate lại?" CTA

### Cost guard sanity

- /admin/usage → confirm:
  - 7 buckets in Cost kill-switch section (including new generate-cover-letter)
  - ALERT_WEBHOOK_URL badge configured
  - Daily table shows Fit Job + Career + Cover Letter columns
  - Visit funnel renders correctly
- Trigger 1 shared-key analyze → confirm cost increments
- Trigger 1 BYOK analyze → confirm cost does NOT increment for shared bucket

### Performance check

- Recommend latency: p95 ≤ 8s
- Vertical index populated (`pnpm run ingest build-vertical-index`)
- Cover letter latency: p95 ≤ 6s

### Polish list (fix what's found)

- [ ] Tier badge colors render correctly across light/dark modes
- [ ] Red flag banner doesn't push refined-cv content too far down (test long banner)
- [ ] Action button text wraps gracefully on narrow viewport
- [ ] Mobile responsive: tier badge readable < 375px
- [ ] Existing tests still pass: `pnpm test`
- [ ] Build clean: `pnpm build` + Vercel deploy verify

### Ship

```powershell
# Final commit batch:
git add -p   # Selective stage
git commit -m "feat(wave-a): fit tier system + red flag UI + action column + cover letter"
git push origin main
```

If 5-day work was 1 long branch: split into 4 logical commits matching phases:
- `feat(jobs): fit tier compute + badge atom`
- `feat(ui): red flag section + banner on /analyze and /refined-cv`
- `feat(job-fit): action column wiring per tier with /refined-cv mode prompts`
- `feat(cover-letter): new endpoint + 3/day quota + cost bucket + UI`

### Update reports + plans

- Add changelog entry in `docs/project-changelog.md`
- Mark plan.md `status: completed`
- Update `260603-1205-ui-polish/plan.md` "related" note: TierBadge + RedFlagsSection now exist, atom polish can add tokens

## Acceptance

- All 8 E2E steps green
- Lighthouse a11y ≥ 95 on key pages
- 0 console errors
- Cost guard 7 buckets functional
- pnpm test passes
- pnpm build clean
- 4 commits pushed to main, Vercel deploys green

## Risks

- Mode prompt variants drift from apply intent → manual diff check 3 modes with same CV+JD
- Cover letter render markdown styling — use existing MarkdownView
- Race condition refined-cv?jobId&mode + manual refine button → store guards
- Tier underfill on real prod data — common case D/E empty; UI handles

## Done criteria

Plan complete. Update memory: `feedback_scoring_ux_model` still holds; `feedback_error_surfacing_no_silent_fallback` enforced for cover letter; add new memory if any locked decision should persist across sessions.

Next plan in queue: `260602-1739-hybrid-refresh-topup` (R1-R7).
