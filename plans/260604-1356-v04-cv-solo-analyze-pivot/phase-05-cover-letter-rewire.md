# Phase 5 — Cover Letter Rewire (Job Fit Detail Entry)

**Effort:** 1-2h
**Owner:** lead
**Status:** pending
**Blocked by:** phase 1
**Blocks:** phase 6

## Goal

Move Cover Letter generation entry point from standalone form (which required separate JD paste) to a "Tạo Cover Letter" CTA on Job Fit detail page. Cover Letter API accepts `{ jobId, cvText }` — uses Job's description from KV instead of user-pasted JD. Remove standalone form per decision #5 (default: hard-remove, no feature flag).

## Files to Create

- `src/features/job-fit/cover-letter-button.tsx` — CTA button + result modal, ≤ 150 lines
- `tests/features/job-fit/cover-letter-button.test.tsx` — RTL covering states (idle / loading / success / error / quota-exceeded)

## Files to Modify

- `src/app/api/cover-letter/route.ts` — accept `{ jobId, cvText }` instead of `{ jdText, cvText }`; fetch job from KV; use `job.description` as JD input internally
- `src/features/job-fit/job-fit-detail-page.tsx` — add `<CoverLetterButton jobId={job.id} />` to action area
- `src/features/job-fit/detail-actions-bar.tsx` — insert CTA alongside existing actions
- `src/features/job-fit/api-client.ts` — add `generateCoverLetter(jobId, cvText)` client
- `src/features/cover-letter/page.tsx` — DELETE (or temporarily route to /job-fit with explainer)
- `src/features/cover-letter/standalone-form.tsx` — DELETE
- `src/app/(app)/cover-letter/page.tsx` — DELETE the route or replace with redirect to /job-fit

## API Contract Change

```
POST /api/cover-letter
  Body BEFORE:  { cvText, jdText }
  Body AFTER:   { cvText, jobId }
  
  Server flow:
    1. Resolve auth (existing)
    2. Quota check (3/day cover-letter bucket)
    3. Fetch job from KV by jobId (404 if missing)
    4. Build prompt with cvText + job.description + job.title + job.company
    5. Call LLM → markdown response
    6. Record cost
    7. Return { markdown, schemaVersion: 'v2' }   // bump if cover-letter shape changes
  
  Response 200: { markdown, schemaVersion }
  Response 400: missing jobId / cvText / cvText too short
  Response 404: jobId not in KV
  Response 429: quota exceeded
```

## Component Sketch

```tsx
// cover-letter-button.tsx
'use client';
export function CoverLetterButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const cvText = useAnalyzeStore((s) => s.cvText);
  const { mutate, data, error, isLoading } = useSWRMutation(
    `/api/cover-letter`,
    (url, { arg }: { arg: { jobId: string; cvText: string } }) =>
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(arg) })
        .then((r) => r.ok ? r.json() : Promise.reject(new ApiError(r.status, r.statusText)))
  );

  const handleGenerate = () => {
    if (!cvText) {
      // No CV in store — direct user to /analyze first
      window.location.href = '/analyze?then=cover-letter';
      return;
    }
    setOpen(true);
    mutate({ jobId, cvText });
  };

  return (
    <>
      <Button onClick={handleGenerate} variant="primary">
        <IconLetter /> Tạo Cover Letter
      </Button>
      <CoverLetterResultModal
        open={open}
        onClose={() => setOpen(false)}
        markdown={data?.markdown}
        error={error}
        isLoading={isLoading}
      />
    </>
  );
}
```

## CV Source

Cover Letter needs the user's CV. Source = `useAnalyzeStore().cvText` (sessionStorage `analyze:v3`). If empty (user hasn't run analyze yet):
- Option A: redirect to `/analyze?then=cover-letter&jobId=X` → after analyze, prompt to continue to cover letter
- Option B: inline CV paste modal as fallback
- **Recommendation**: A (cleaner funnel, drives /analyze adoption)

## Implementation Steps

1. Refactor `route.ts`:
   - Replace `jdText` parsing with `jobId` lookup
   - `fetchJob(jobId)` from KV → 404 if missing
   - Internal prompt uses `job.description` + `job.title` + `job.company`
   - Existing quota check + cost recording unchanged
2. Build `cover-letter-button.tsx` per sketch. Modal renders markdown via existing renderer.
3. Add CTA to `detail-actions-bar.tsx` (or wherever Apply CTA lives).
4. Delete standalone form files. Update nav links / footer if they pointed at /cover-letter.
5. Add redirect route: `app/(app)/cover-letter/page.tsx` → `redirect('/job-fit')` with optional message. Or remove entirely + handle 404 via Next.js default.
6. RTL tests:
   - Click CTA with CV in store → modal opens + API fires
   - Click CTA without CV → redirects to `/analyze?then=cover-letter`
   - API success → markdown rendered
   - API 429 → quota error message
   - API 404 → "Job no longer available"
7. Smoke: open Job Fit detail in preview env → click CTA → modal generates cover letter.

## Acceptance Criteria

- [ ] `/api/cover-letter` accepts `{ jobId, cvText }`; rejects `jdText`
- [ ] Job lookup by ID; 404 surfaces correctly
- [ ] CTA renders on Job Fit detail; opens modal on click
- [ ] No-CV path redirects to `/analyze?then=cover-letter`
- [ ] Standalone form + page route removed (or replaced with redirect)
- [ ] Existing quota (3/day) still enforced
- [ ] Cost recording unchanged
- [ ] `pnpm tsc --noEmit` clean
- [ ] vitest passes

## Risks

- **CV not in sessionStorage**: user lands on Job Fit detail without running analyze first → CTA must handle gracefully. Mitigation: redirect path A above.
- **`?then=cover-letter` flow not standard**: query-param-driven post-analyze redirect is new pattern. Mitigation: store `then` in state during analyze; on analyze complete, if `then === 'cover-letter'`, prompt "Tiếp tục với Cover Letter?" with stored jobId.
- **Adoption drop from form removal**: as called out in plan top risks. Mitigation: track cover-letter / job-fit-view ratio week-1; if < pre-pivot baseline -20%, reconsider form-flag rollback.
- **Old bookmarked /cover-letter URLs return 404**: minor; redirect mitigates.

## Security

- jobId validation: must match `[a-f0-9]{16}` (job ID shape per existing convention) before KV lookup; prevents injection
- CV text sanitized on server (existing pattern)
- API returns markdown only; rendered via existing markdown sanitizer (no raw HTML allowed)

## Next Phase

→ phase-06-cache-version-bump.md (after Phases 3 + 4 + 5 done)
