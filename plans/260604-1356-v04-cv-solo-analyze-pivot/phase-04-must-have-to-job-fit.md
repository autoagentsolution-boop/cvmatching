# Phase 4 — Move Must-Have Block to Job Fit Detail

**Effort:** 1-2h
**Owner:** lead
**Status:** pending
**Blocked by:** phase 1
**Blocks:** phase 6

## Goal

Relocate the must-have requirements UI block from `/analyze` result to `job-fit-detail-page.tsx`. Each Job already carries `mustHaves: string[]` from ingest. Render block inline above match-reasons. Mobile collapsible default-open. Empty-state for legacy 150 jobs without populated mustHaves.

## Files to Create

- `src/features/job-fit/must-have-block.tsx` — extracted component, ≤ 100 lines
- `src/features/job-fit/must-have-block.test.tsx` — RTL render states

## Files to Modify

- `src/features/job-fit/job-fit-detail-page.tsx` — insert `<MustHaveBlock mustHaves={job.mustHaves} />` above match-reasons
- `src/lib/jobs/types.ts` — confirm `Job.mustHaves?: string[]` present (already exists from v0.3 — verify)
- (delete in Phase 7) `src/features/analyze/must-have-block.tsx` — old location if exists

## Data Verification

```bash
# Before implementation: verify Job.mustHaves is populated in live KV
pnpm tsx --env-file=.env.local scripts/inspect-job.ts <jobId>
# Expect mustHaves array; if empty for most jobs, document backfill plan
```

## Render States

| State | Trigger | UI |
|---|---|---|
| Populated | `job.mustHaves?.length >= 1` | List of must-haves with check/X icons (no CV-comparison, just listing) |
| Empty | `mustHaves` undefined or `[]` | Empty-state copy: "Bài đăng không liệt kê must-haves rõ ràng" |
| Loading | n/a — data is SSR-loaded with job, never async after mount | — |

## Component Sketch

```tsx
// must-have-block.tsx
export function MustHaveBlock({ mustHaves, className }: Props) {
  if (!mustHaves?.length) {
    return (
      <section className={cn(styles.block, className)}>
        <h3>Yêu cầu bắt buộc</h3>
        <p className={styles.muted}>Bài đăng không liệt kê must-haves rõ ràng.</p>
      </section>
    );
  }

  return (
    <section className={cn(styles.block, className)}>
      <h3>Yêu cầu bắt buộc ({mustHaves.length})</h3>
      <ul className={styles.list}>
        {mustHaves.map((mh, i) => (
          <li key={i} className={styles.item}>
            <IconCheckCircle className={styles.icon} />
            <span>{mh}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Note: removed CV-comparison semantics (no green-tick for "you have this" vs red-X for "you don't"). Must-have block is now pure job-side info — user reads + self-assesses. Comparison was only meaningful when CV-vs-JD was the analyze model.

## Integration into Job Fit Detail Page

```tsx
// job-fit-detail-page.tsx structure (additions only)
return (
  <div className={styles.page}>
    <JobTitleHeader job={job} match={match} />
    <CompanyCard companyId={job.companyId} />          {/* future from 260604-1218 */}
    <MustHaveBlock mustHaves={job.mustHaves} />        {/* NEW */}
    <JobScoreBlock match={match} />
    <MatchReasonsBlock match={match} />
    <StudyTopicsBlock match={match} />
    <DetailActionsBar jobId={job.id} />
  </div>
);
```

## Mobile Layout

- Desktop: full-width block above match-reasons
- Mobile: `<details>` wrapper, default open if mustHaves populated; closed if empty
- Sticky-nothing — block is a normal flow element

## Implementation Steps

1. Verify `Job.mustHaves: string[]` exists in `types.ts`. If missing in some ingest path, document gap — Phase 4 unblocks even if 150 live jobs are empty (organic backfill on next ingest).
2. Build `must-have-block.tsx` per sketch. Reuse existing icon components.
3. Edit `job-fit-detail-page.tsx`: import + place above match-reasons-block.
4. RTL tests:
   - mustHaves array of 5 → renders all 5 with icons
   - mustHaves undefined → empty-state
   - mustHaves empty array → empty-state
   - Mobile media query → `<details>` rendered
5. Visual check: dev server, navigate to 3 sample Job Fit details (1 with populated, 1 without, 1 marketing). Screenshot to `Screenshot/v4-job-fit-musthave-{state}.png`.
6. If old analyze location had a must-have component, mark for deletion in Phase 7. Defer hard-removal until Phase 3 UI ships, to avoid orphan imports.

## Acceptance Criteria

- [ ] `MustHaveBlock` component exists with 2 render states (populated + empty)
- [ ] Component rendered in `job-fit-detail-page.tsx` above match-reasons
- [ ] Empty state copy in Vietnamese, no AI-leaked text
- [ ] Mobile responsive (collapsible if needed)
- [ ] RTL tests cover both states
- [ ] No regression in existing Job Fit detail UX (visual confirm)
- [ ] `pnpm tsc --noEmit` clean

## Risks

- **Legacy 150 jobs have empty mustHaves**: empty-state covers visually but user may wonder. Mitigation: copy explicit ("Bài đăng không liệt kê") not ambiguous ("Chưa có dữ liệu"); organic refresh on next ingest cycle adds them.
- **Must-have quality variance from LLM ingest**: some jobs have great must-haves, some have garbage. Mitigation: out of scope for this phase — Phase 7 of `260603-1655-ingest-taxonomy` or a future ingest-quality plan covers must-have prompt tuning.

## Security

- All must-have strings rendered via React (auto-escaped)
- No `dangerouslySetInnerHTML`
- Source = job.mustHaves from KV (already-sanitized at ingest)

## Next Phase

→ phase-05-cover-letter-rewire.md (parallel — both unblocked by Phase 1)
