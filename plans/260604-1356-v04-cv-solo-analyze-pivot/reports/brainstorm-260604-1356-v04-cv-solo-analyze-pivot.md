---
type: brainstorm
date: 2026-06-04
plan: 260604-1356-v04-cv-solo-analyze-pivot
author: claude (opus 4.7) + /btw fork
session: 6/4/2026 13:56 GMT+7
---

# Brainstorm — v0.4 Pivot

## Context

User shared strategic shift via /btw fork mid-session (after taxonomy taxonomy work). Pivot motivation = market positioning: sellable product needs lower activation friction + wider TAM. Current CV-vs-JD analyze gates value behind "find a JD first," shrinks audience to active applicants. CV-solo opens analyze to passive job-seekers, HR doing self-audit, headhunters scoring incoming CVs — 5-10× larger audience.

Future vision = auto pipeline: user declares desired role → daily cron scores fresh jobs → email digest of quick-win interviews. Pivot is the foundation for that pipeline.

## Decisions (locked via fork Q&A)

| # | Topic | Decision | Implication |
|---|---|---|---|
| 1 | Role extraction | LLM infer + confirm modal when conf < 0.75 (top candidates + free text) | Role-infer becomes 1st LLM call before scoring |
| 2 | Analyze quota | Stay 5/day | No change to consume-quota.ts |
| 3 | Pricing | Quota-only paywall, defer paid tier | Focus on growth, not monetization yet |
| 4 | Cache compat | Version bump + banner "app updated, re-analyze?" | User-driven, do NOT auto-burn quota |
| 5 | Cover Letter | Generate from Job Fit detail, remove standalone JD form | Reduces 2nd JD-input surface |
| 6 | Sequencing | **Pivot BEFORE pilot reopen** | Reopen with new funnel = correct first-touch |

## Strategic rationale

**Activation funnel reshape:**
```
v0.3.1: Land → Paste CV → Find JD → Paste JD → Analyze → Result
              (high abandon at JD-hunt step)

v0.4:   Land → Paste CV → Analyze → Result (role inferred or quick confirm)
              (cleaner, faster, broader audience)
```

**Funnel continuation unchanged:**
```
Analyze (health check) → Refined CV (polish) → Job Fit (open jobs) → Apply
                                              ↳ Cover Letter from Job detail
```

## Architecture sketch

**Analyze endpoint (2-stage):**
```
POST /api/analyze { cvText }
  → role-infer LLM (cheap, ~$0.001/call)
    → high conf: proceed to scoring
    → low conf: return { needsRoleConfirm, candidates: [...] }
  → scoring LLM (CV-solo 9-dim rubric, ~$0.01/call)
  → return { role, scores, recommendations, gaps, ..., schemaVersion: 'v3' }
```

**Scoring rubric semantic shift (mechanics unchanged):**

| Dim | v0.3.1 (CV-vs-JD) | v0.4 (CV-solo) |
|---|---|---|
| skills | Match between CV skills and JD requirements | Depth/breadth/modernity of stated stack for the claimed role |
| experience | Coverage of JD-listed responsibilities | Narrative quality: impact, scope, progression, quantified results |
| education | Degree match for JD requirement | Signaling quality + role fit |
| seniority | Match to JD seniority | Cohesion: does CV demonstrate claimed seniority? |
| location | Match to JD location | Clarity + presentation |
| tools | Tool overlap CV ∩ JD | Tool stack depth for role |
| domain | Domain overlap CV ∩ JD | Domain depth demonstration |
| industry | Industry overlap | Industry presentation strength |
| soft | Soft skills evidenced + JD-aligned | Soft skills evidenced clearly |

Sliders, recomputation, frozen artifacts — IDENTICAL.

**Must-have block relocation:**
- v0.3.1: rendered on `/analyze` result as "JD must-haves vs your CV"
- v0.4: rendered on Job Fit detail per-job (each Job already has `mustHaves[]` from ingest)

**Cover Letter relocation:**
- v0.3.1: standalone page with own JD-paste form + cvText prompt
- v0.4: CTA button on Job Fit detail; uses `job.description` + sessionStorage CV; no extra paste step

**Cache version migration:**
```
First visit post-deploy:
  - read sessionStorage analyze:v2 → if present, show banner
  - banner copy: "Ứng dụng đã cập nhật — Analyze lại để xem điểm theo cấu trúc mới?"
  - actions: [Analyze lại] [Bỏ qua]
  - on Re-analyze: clear v2, fire POST /api/analyze with stored CV (if available), write v3
  - on Dismiss: clear v2, render empty /analyze state (no analysis)
```

## Phase decomposition (effort estimate)

```
Phase 1 — Scoring prompt rewrite (D)            2-3h
Phase 2 — API analyze refactor (A)              3-4h
Phase 3 — UI analyze restructure (B)            2-3h
Phase 4 — Must-have to Job Fit (C)              1-2h
Phase 5 — Cover Letter rewire (new from #5)     1-2h
Phase 6 — Cache version bump (E)                1h
Phase 7 — Memory + docs sync (F)                30 min
────────────────────────────────────────────────
TOTAL                                           10-14h (2-3 days)
```

## Sequencing dependency

```
Phase 1 (prompt) ─┬─→ Phase 2 (API) ─→ Phase 3 (UI) ─→ Phase 6 (cache) ─→ Phase 7 (docs)
                 ├─→ Phase 4 (must-have to Job Fit)
                 └─→ Phase 5 (Cover Letter rewire)
```

Phases 4 + 5 parallel after Phase 1. Critical path = 1 → 2 → 3 → 6 → 7.

## Backlog re-ordering (post-pivot decisions)

```
NOW (Tier 1 — already shipped this session):
  ✓ Taxonomy fold-bug fix + tech P2 patterns (committed de74d23)
  ✓ Company-reviews plan scaffold (committed 2381c4a)
  → v0.4 pivot plan scaffold (this plan)

NEXT (pivot impl):
  Phase 1-7 of this plan (10-14h, 2-3 days)

THEN (post-pivot):
  - Pilot reopen hardening + 4-step runbook (~3-4h)
  - Phase 4 wipe + re-ingest (14d seed; verify Job.mustHaves[] populated)
  - Hybrid refresh top-up R1-R7
  - Company-reviews implementation (260604-1218 scaffold)
  - UI polish
  - Email digest infra (auto-pipeline G — needs auth + Resend)
```

## Memory entries needing touch when pivot ships

1. `[[feedback_scoring_ux_model]]` — body update: rescope from CV-vs-JD per-dim → CV-solo per-dim. Mechanics line stays.
2. `[[project_cvmatching_v01_state]]` — bump to v0.4; document pivot; remove "tomorrow's task = run runbook" (now blocked by pivot).
3. `[[project_v04_pivot_cv_solo_analyze]]` — convert from "captured" to "shipped" on ship.

Existing memory references to CV-vs-JD already flagged in `project_v04_pivot_cv_solo_analyze` for batch touch at Phase 7.

## Risk summary

1. Role-inference accuracy on weak CV headers (VN CVs often missing summary) — confidence threshold + confirm modal mitigates
2. v3 prompt regression vs v2 quality — A/B fixture suite mandatory in Phase 1
3. sessionStorage migration confusion — explicit banner + empty-state fallback
4. Must-have empty on legacy 150 jobs — accept organic backfill on next ingest cycle
5. Cover Letter usage drop on form removal — watch conversion week-1, flag rollback option ready
6. Activation hypothesis wrong — track completion + bounce rate post-deploy; 2-week retro before more dev

## Cross-references

- Plan dir: `plans/260604-1356-v04-cv-solo-analyze-pivot/`
- Memory anchor: [[project_v04_pivot_cv_solo_analyze]]
- Pre-pivot v0.3.1 state: [[project_cvmatching_v01_state]]
- Existing scoring model memo: [[feedback_scoring_ux_model]]
- Company-reviews scaffold (deferred post-pivot): `plans/260604-1218-company-profile-reviews/`
- Pilot reopen runbook (gated): `docs/deployment.md §17`

## Unresolved (carry to user / Phase impl)

1. Role-inference confidence threshold 0.75 — calibrate after Phase 2 fixture run
2. Cover Letter standalone form: hard-remove vs feature-flag transition (default: hard-remove)
3. `Job.mustHaves[]` backfill on 150 live jobs: one-off ingest pass vs accept organic (default: accept organic)
4. `schemaVersion` long-term: per-feature vs app-wide (default: per-feature)
5. Re-analyze banner copy: VN-only or bilingual?
