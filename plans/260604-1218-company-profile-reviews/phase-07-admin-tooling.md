# Phase 7 — Admin Tooling (Dedup Queue + Manual Actions + Refetch)

**Effort:** 2-3h
**Owner:** lead
**Status:** pending
**Blocked by:** phases 1-6 (needs data to admin over)
**Blocks:** none

## Goal

Admin surface for the 3 manual workflows: (1) resolve dedup queue items in 0.7-0.95 grey zone, (2) force-refetch Tier 1 / ratings / enrichment for any company, (3) view top-N most-viewed + most-failed companies. Gated behind existing admin auth. Build only what's actionable today — heatmaps / analytics deferred.

## Files to Create

- `src/app/(app)/admin/companies/page.tsx` — main admin page, tabs: Dedup queue / All companies / Failures
- `src/app/(app)/admin/companies/dedup-queue-table.tsx` — table component, ≤ 150 lines
- `src/app/(app)/admin/companies/company-row-actions.tsx` — per-row action dropdown, ≤ 100 lines
- `src/app/api/admin/companies/dedup-queue/route.ts` — `GET` list, paginated
- `src/app/api/admin/companies/dedup-resolve/route.ts` — `POST { sourceSlug, action: 'merge' | 'split' | 'reject', targetSlug? }`
- `src/app/api/admin/companies/[slug]/refetch-tier1/route.ts` — `POST` re-runs Phase 2 scrape
- `src/app/api/admin/companies/[slug]/refetch-enrichment/route.ts` — `POST` re-runs Phase 5 LLM
- (Phase 3 already created `refetch-ratings/route.ts`)
- `src/lib/companies/admin-actions.ts` — shared merge / split logic, ≤ 150 lines
- `src/lib/companies/admin-actions.test.ts` — merge / split correctness

## Files to Modify

- `src/app/(app)/admin/layout.tsx` (or equivalent admin nav) — add `Companies` link
- `src/lib/companies/kv-client.ts` — add `listDedupQueue(cursor)`, `removeDedupItem(slug)`, `mergeCompanies(from, to)`

## Dedup Queue Item Shape

```ts
// types.ts (added in Phase 1)
export interface DedupCandidate {
  normalizedName: string;        // the name being resolved
  rawName: string;
  candidateSlug: string;         // best match from existing
  score: number;                 // 0.7-0.95
  enqueuedAt: string;
  contextJobIds: string[];       // first 5 jobs that hit this case
}
```

## Admin Actions

### Merge (sourceSlug → targetSlug)

When admin confirms `sourceSlug` is the same company as `targetSlug`:
1. Copy non-empty Tier 1 fields from `source` into `target` (target wins on conflict — admin curated)
2. Move all `source.aliases` into `target.aliases`
3. Update all `co-alias:*` entries pointing to `source` → point to `target`
4. Update all `Job.companyId = source` → `target` (KV scan + batch update)
5. Delete `co:{source}`, `co-ratings:{source}`, `co:{source}.enrichment` (target keeps its own)
6. Remove dedup queue entry
7. Audit log: `{action: 'merge', from: source, to: target, by: adminUser, at: now, jobsUpdated: N}`

### Split (sourceSlug stays separate)

When admin confirms it's a different company:
1. Mint new slug if dedup auto-attached a provisional `companyId` to jobs (need to re-resolve those jobs)
2. Or: keep provisional mapping if admin confirms it's actually a sister-company and provisional is OK
3. Remove queue entry
4. Audit log

### Reject (delete queue entry, no data change)

Spam / nonsense — discard.

## Refetch Endpoints

All POST, admin-gated, idempotent. Body empty. Response 200 with refetched data or 502 with error.

| Endpoint | Behavior |
|---|---|
| `POST /api/admin/companies/{slug}/refetch-tier1` | Re-run Phase 2 scrape, overwrite Tier 1 fields, reset `tier1ExpiresAt` |
| `POST /api/admin/companies/{slug}/refetch-ratings` | (Phase 3) re-scrape Glassdoor + Google, overwrite `co-ratings:{slug}` |
| `POST /api/admin/companies/{slug}/refetch-enrichment` | Re-run Phase 5 enrichment, overwrite `co.enrichment` |

Each rate-limited 10/min per IP (reuse existing rate-limit util).

## UI Sketch

```
┌─ Admin / Companies ─────────────────────────────────────────────┐
│ [Dedup Queue (12)] [All Companies] [Failures]                   │
├─────────────────────────────────────────────────────────────────┤
│ Dedup Queue                                                     │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐    │
│ │ Raw: "FPT Software Hà Nội"        Score: 0.87            │    │
│ │ Candidate: fpt-software ("FPT Software")                 │    │
│ │ Context: 3 jobs (job-abc, job-def, job-xyz)              │    │
│ │ [Merge into fpt-software] [Mint as new] [Reject]         │    │
│ └──────────────────────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────────────────────┐    │
│ │ Raw: "VNG Game Studios"          Score: 0.82             │    │
│ │ Candidate: vng-corp ("VNG Corporation")                  │    │
│ │ Context: 2 jobs                                          │    │
│ │ [Merge] [Mint as new] [Reject]                           │    │
│ └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

Per-company "All Companies" tab: search by name → show company card preview + action dropdown (Refetch Tier 1 / Refetch Ratings / Refetch Enrichment / View Audit Log).

Failures tab: list of `tier1Pending: true` companies + recent enrichment errors (from `co-enrich-calls` failure log).

## Implementation Steps

1. Build `admin-actions.ts` with `mergeCompanies(from, to, adminId)` + `rejectDedup(slug)` + transactional safety (queue all KV writes, execute as batch, rollback on partial fail).
2. Implement `dedup-queue/route.ts` (paginated GET, cursor-based via KV SCAN).
3. Implement `dedup-resolve/route.ts` (POST). Wire into shared `admin-actions`.
4. Build `dedup-queue-table.tsx` — fetches via SWR, renders rows, action buttons fire POST + optimistic UI.
5. Build `company-row-actions.tsx` — dropdown menu (use existing shadcn-style DropdownMenu).
6. Implement 3 refetch endpoints. Each wraps Phase 2/3/5 functions; admin auth check; rate-limit.
7. Build "All Companies" search + "Failures" tab — read-only views.
8. Add `Companies` link to admin nav.
9. Audit log: write to KV key `co-audit:{YYYY-MM-DD}:{ulid}` → `{action, from, to, by, at, ...}` with 90d TTL. View in Failures tab or dedicated audit log page (defer if scope creeps).
10. E2E test: merge 2 companies, verify alias index + jobs updated correctly.

## Acceptance Criteria

- [ ] Admin can resolve dedup queue items (merge / split / reject)
- [ ] Merge correctly updates: aliases, alias index, all Job.companyId references
- [ ] 3 refetch endpoints work; rate-limited; auth-gated
- [ ] Failures tab lists `tier1Pending: true` companies
- [ ] All admin actions audit-logged with 90d retention
- [ ] No admin action accessible without admin auth (e2e auth test asserts 401 unauth)
- [ ] `pnpm tsc --noEmit` clean
- [ ] vitest admin-actions/ suite green

## Risks

- **Merge race**: admin merges A→B while a new ingest assigns provisional `companyId: A` to a job. Result: orphan jobId pointing to deleted slug. Mitigation: merge holds a brief KV lock on both slugs (5s) during the merge; new resolves wait or retry; lock release in finally block.
- **Mass-update on `Job.companyId`**: a merge of a popular company touches hundreds of jobs (KV scan + writes). At pilot scale (150 jobs) trivial; at Phase 8 (10K+) needs background job. Mitigation: cap merges at 1000 jobs synchronously; over that → return 202 + queue for background processor (defer to Phase 8).
- **Admin accidentally rejects valid dedup**: candidate was actually a match, rejected → eternal duplicate. Mitigation: reject doesn't delete the new company, just removes queue entry; admin can manually re-merge later via "All Companies" search.
- **Audit log fills KV**: 90d × N actions/day. At pilot scale (~10 actions/day max) negligible. Phase 8 moves to Postgres audit_log table.

## Security

- All endpoints behind existing admin middleware (per memory [[project_cvmatching_v01_state]] 3-layer bypass)
- Audit log captures admin user identity (read from auth context)
- Refetch endpoints respect monthly enrichment budget — admin force-refetch counts toward `co-enrich-calls:{month}` (admin can blow budget if reckless; alerting at 80% catches it)
- No bulk-delete endpoint exposed — single-slug operations only
- CSRF: admin endpoints check existing CSRF token pattern (or rely on same-site cookie if that's the project standard — verify in implementation)

## Team Impact

- Document admin runbook in `docs/deployment.md` §18 (new): "Resolving dedup queue", "Force-refetch company data"
- Add `Companies` admin link to deployment checklist

## Next Phase

→ phase-08-postgres-ugc-deferred.md (deferred — post-pilot, blocked on auth maturity)
