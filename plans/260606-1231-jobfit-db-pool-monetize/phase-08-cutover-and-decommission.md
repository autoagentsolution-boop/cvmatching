# Phase 08 — Cutover + KV Decommission

## Context Links

- Migrated data: Phase 03
- New repo: Phase 02 `repo-postgres.ts`
- New route: Phase 04 (with feature flag `JOBFIT_USE_POSTGRES`)
- Legacy: `cv-ex-refactor/src/lib/jobs/{repo.ts,score.ts,vertical-index.ts,pack-embeddings.ts}`

## Overview

- Priority: P2
- Status: pending
- Effort: 3-5h
- Blocks: full project closure
- Blocked by: 03, 04, 06, 07

Final step. Flip `JOBFIT_USE_POSTGRES=true` in production; observe 72h; once stable, delete legacy KV-only code paths + drop `job:*` keys + `vertical-index` sidecar. Keep KV embed-cache + quota + kill-switch intact.

## Key Insights

- Cutover is a two-stage process: (1) flip flag + observe, (2) delete code + KV keys.
- Snapshot KV `job:*` to a local JSON file BEFORE deletion (90-day audit retention).
- `embeddings:active:current` + `embeddings:active:v*:*` keys are now stale — delete after observation.
- `jobs:active` + `jobs:expired` SETs no longer needed (Postgres `active` column replaces them).
- `jobs:by-vertical` sidecar no longer needed.
- `embed-cache:*` keys STAY — recommend route still uses KV-backed embed cache.
- `usage:*`, `cost:*`, `killswitch:*` keys STAY — quota infra untouched.

## Requirements

**Functional:**
- Stage 1: flip `JOBFIT_USE_POSTGRES=true` in prod; monitor recommend p95 + error rate for 72h.
- Stage 2 (post-observation): delete `repo.ts`, `score.ts`, `vertical-index.ts`, `pack-embeddings.ts`; remove their imports; KV `job:*` snapshot + delete; drop `jobs:active`, `jobs:expired`, `jobs:by-vertical`, `embeddings:active:*`.
- Verify no live caller references the deleted modules (grep + tsc clean).

**Non-functional:**
- Zero downtime cutover.
- Snapshot file location: `data/kv-snapshot-260613.json` (date stamp).
- Rollback window: 7 days before KV keys deleted.

## Architecture

```
Stage 1 (Flag flip):
  prod env: JOBFIT_USE_POSTGRES=true
  recommend route reads Postgres exclusively
  KV jobs:* untouched — emergency revert path

Stage 2 (Decommission):
  pnpm tsx scripts/kv-snapshot.ts > data/kv-snapshot-260613.json
  pnpm tsx scripts/kv-drop-jobs-keys.ts --confirm
  git rm src/lib/jobs/{repo.ts,score.ts,vertical-index.ts,pack-embeddings.ts}
  remove imports + flag plumbing
  deploy

  Remaining KV keys (intact):
    embed-cache:*       (Phase 04 still uses)
    usage:*             (quota)
    cost:job-recommend  (cost-guard)
    cost:sepay-webhook  (new from Phase 06)
    killswitch:*        (kill-switch)
```

## Related Code Files

**To create:**
- `cv-ex-refactor/scripts/kv-snapshot.ts` — dumps all `job:*`, `jobs:*`, `embeddings:*` keys to JSON.
- `cv-ex-refactor/scripts/kv-drop-jobs-keys.ts` — destructive cleanup, `--confirm` required.

**To modify:**
- `cv-ex-refactor/src/app/api/jobs/recommend/route.ts` — remove feature flag branch, default to Postgres path.
- `cv-ex-refactor/src/lib/jobs/embed.ts` — no change.
- `cv-ex-refactor/src/lib/jobs/embed-cache.ts` — no change (KV-resident, intentional).
- `cv-ex-refactor/src/lib/jobs/classify.ts` — no change (in-process).
- `cv-ex-refactor/src/lib/jobs/classify-cv-vertical.ts` — no change.
- `docs/system-architecture.md` — final state diagram.
- `docs/deployment.md` §13 — final KV inventory (cache/quota/cost only).
- `docs/project-changelog.md` — record the cutover with date + commit hash.

**To delete:**
- `cv-ex-refactor/src/lib/jobs/repo.ts` (KV impl)
- `cv-ex-refactor/src/lib/jobs/score.ts` (in-mem cosine)
- `cv-ex-refactor/src/lib/jobs/vertical-index.ts`
- `cv-ex-refactor/src/lib/jobs/pack-embeddings.ts`
- `cv-ex-refactor/scripts/ingest-rebuild-embeddings.ts` (KV-blob specific)
- `cv-ex-refactor/src/lib/jobs/refresh-batch.ts` — IF references KV repo (verify; may stay)

## Implementation Steps

1. **Pre-flight:**
   - Phase 03 migration verified.
   - Phase 04 deployed with flag default false.
   - Phase 06 deployed (paid tier path works).
   - Phase 07 deployed.

2. **Stage 1 — Flag flip:**
   ```powershell
   # Operator
   vercel env add JOBFIT_USE_POSTGRES production
   # value: true
   vercel deploy --prod
   ```
   - Monitor for 72h: Vercel logs, recommend p95, error rate, embed-cache hit rate, KV vs DB query latency.
   - If issues: flip env to `false`, redeploy → instant rollback to KV reads.

3. **Stage 2a — Snapshot KV:**
   ```powershell
   cd cv-ex-refactor
   vercel env pull .env.snap --environment=production
   pnpm tsx scripts/kv-snapshot.ts --env-file .env.snap > ../data/kv-snapshot-260613.json
   ```
   Snapshot shape: `{ jobs: Record<id, Hash>, embeddings: { version, chunks, ids } }`.

4. **Stage 2b — Code deletion:**
   - Remove the `JOBFIT_USE_POSTGRES` branch in recommend route; postgres becomes default + only path.
   - Delete the 4 files listed above (verify zero remaining imports via `grep`).
   - Remove `kv` dependency calls from those files' callers.
   - Run `tsc --noEmit` + `pnpm build` + `pnpm test` — all green.
   - Commit + deploy.

5. **Stage 2c — KV cleanup (delete jobs keys):**
   ```powershell
   pnpm tsx scripts/kv-drop-jobs-keys.ts --env-file .env.snap --confirm
   ```
   Drops:
   - `job:*`
   - `jobs:active`, `jobs:expired`, `jobs:by-vertical`
   - `embeddings:active:current`, `embeddings:active:v*:*`
   - keeps `embed-cache:*`, `usage:*`, `cost:*`, `killswitch:*`

6. **Stage 2d — Docs sync:**
   - `system-architecture.md`: replace "KV jobs HASH" boxes with "Postgres jobs table".
   - `deployment.md` §13: list ONLY remaining KV keys.
   - `project-changelog.md`: new entry with date, commit hash, before/after pool size.
   - `docs/development-roadmap.md`: mark Postgres migration milestone complete.

7. **Post-mortem checklist** (in commit message):
   - [ ] Recommend p95 before/after
   - [ ] DB query p95
   - [ ] Pool size before/after
   - [ ] Free → Paid conversion in 72h observation window (if any)
   - [ ] Embed-cache hit rate (should be unchanged)

## Todo List

- [ ] Verify Phase 03/04/06/07 deployed + stable
- [ ] Flip JOBFIT_USE_POSTGRES=true in prod
- [ ] Monitor 72h (p95, errors, embed-cache hits)
- [ ] Snapshot KV jobs+embeddings to data/kv-snapshot-{date}.json
- [ ] Delete legacy files (repo.ts, score.ts, vertical-index.ts, pack-embeddings.ts)
- [ ] Verify tsc + tests + build clean
- [ ] Run kv-drop-jobs-keys.ts with --confirm
- [ ] Update docs (system-architecture, deployment §13, changelog, roadmap)
- [ ] Tag release: v0.5.0-postgres-cutover

## Success Criteria

- 72h observation window: p95 ≤25s, error rate ≤2%, embed-cache hit rate ≥40%.
- After deletion: `pnpm tsc --noEmit` green, all tests pass, no broken imports.
- KV inventory matches new spec: only embed-cache + quota + cost + killswitch keys remain.
- Snapshot file exists in `data/` and contains all 171+ pre-migration jobs.

## Risk Assessment

| # | Risk | L | I | Mit |
|---|---|---|---|---|
| 1 | Hidden caller of deleted module breaks at runtime | M | H | tsc check + grep for imports BEFORE delete; staging deploy if available |
| 2 | KV deletion accidentally hits embed-cache or quota keys | L | H | `kv-drop-jobs-keys.ts` uses explicit prefix allow-list + --confirm flag; dry-run mode default |
| 3 | Postgres outage during 72h window → no recommend | L | H | Flag rollback path active for 72h; if outage, flip flag → KV path resumes |
| 4 | Pool count drops post-cutover (some jobs lost in migration not noticed until observation) | L | M | Phase 03 verify step covers; weekly count diff alert |
| 5 | Embed-cache stale after schema change → stale embeddings served | L | L | Cache TTL is 6h; full refresh within a day; not a real risk |

## Security Considerations

- Snapshot file contains job data — not PII, not credentials — safe to commit to `data/` (gitignored anyway).
- Drop script requires `--confirm` flag to prevent accidental wipe.
- Verify Upstash REST token in `.env.snap` is the production token, not preview.

## Rollback Plan

- During Stage 1 (flag flip): set `JOBFIT_USE_POSTGRES=false`, redeploy — instant.
- After Stage 2 code deletion + KV wipe: rollback requires restoring from `data/kv-snapshot-*.json` via a reverse-migration script (write defensively if Stage 1 observation surfaces concerns).
- Window: 7 days. After 7 days, snapshot is archival only; no automated revert.

## Next Steps

- Project state: pilot exit milestone hit (per memory `project_post_pilot_db_migration`).
- Follow-up plans:
  - Renewal nudge emails (Resend)
  - Daily-score cron + email digest (per memory v0.4 deferred)
  - Pool ≥5K target (add careerlink, careerviet, careerbuilder)
  - Postgres metrics dashboard (Grafana? Neon's native?)
