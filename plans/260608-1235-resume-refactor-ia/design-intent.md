# Design Intent — Resume Refactor IA

**Created:** 2026-06-08
**Source of truth:** User-provided references in `refs/`. Stitch outputs are exploratory only — references win on conflict.

## Brand

- **App name:** Resume Refactor (was: CVMatching)
- **Tagline placement:** below logo in sidebar (optional)
- **Version chip:** top-right header, e.g. "v0.5 Beta"

## Top-level architecture

Two workflows, both rendered inside the same shell. Last 3 stepper steps are **SHARED** downstream actions.

```
Resume Refactor (app shell)
├── Thin sidebar (~60px, icon-only) — workspace nav
│   ├── 📄 My CVs (library)
│   ├── ⚡ CV Analyze workflow
│   ├── 🎯 JD Matching workflow
│   └── 🕐 History
└── Main area: workflow-specific stepper + content

CV Analyze flow:    [CV Analyze]  → Refined CV → Roadmap → Job Fit
JD Matching flow:   [JD Matching] → Refined CV → Roadmap → Job Fit
                                    └────── shared 3 steps ──────┘
```

**Implication for BE:** `prompt-generate-cv.ts`, `prompt-career-path.ts`, `prompt-job-recommend.ts` already accept optional JD-context — just need routing to pass `jdId` from JD Matching entry vs omit from CV Analyze entry. No new prompt versions needed.

## Per-step layout contract

All steps follow the same 2-column pattern:

```
┌─────────────────────────────────────────────────┐
│  [chevron stepper across top — current active]  │
├──────────────────────┬──────────────────────────┤
│                      │                          │
│  Source Document(s)  │   Step-specific results  │
│  (sticky, left)      │   (right, scrollable)    │
│                      │                          │
│  • Source CV always  │   Each step has its own  │
│  • + Source JD if    │   hero + cards           │
│    JD Matching flow  │                          │
│                      │                          │
└──────────────────────┴──────────────────────────┘
```

### Source Document rendering (Phase 3 — non-trivial)

- **Visual format:** rendered as PDF/Word-style page (white sheet, formatted sections, real fonts) — NOT raw textarea
- **Underlying data:** parsed text string (same as today) — visual is presentation-only
- **Icons in card header:** zoom (in/out), fullscreen (modal overlay), **Import** (LOCKED)
- **Card label:** "SOURCE CV" / "SOURCE JD" (caps small text top of card)
- **Import button (LOCKED):** prominent on BOTH Source CV and Source JD cards:
  - **PDF/Word upload** → file picker → server-side parse (pdf-parse for PDF, mammoth for DOCX) → store parsed text → re-render
  - **URL paste (JD only)** → input field for job posting URL → reuse ingest scraper logic (TopCV/ITviec/VL24h selectors) → extract title + description → store
  - Verify existing parser availability in current codebase during Phase 1 (user belief: already exists)

## Per-step content spec

### Step 1a — CV Analyze (CV-solo entry)

**Right column:**
1. **Detected Role chip** at top: "Senior Backend Engineer" (LLM-inferred) + edit icon → modal for manual override
2. **Hero card — Overall Role Fit**
   - Big circular gauge (numeric + status word, e.g. "78 STRONG FIT" / "65 PARTIAL FIT" / "42 STRETCH")
   - Caption: "Your CV evidences a STRONG FIT for Senior Backend Engineer — sharpen Experience to push past 85."
   - Primary CTA: "Improve Fit" → jumps to Refined CV step
3. **3 role-fit metrics** as horizontal bars (LOCKED — all derived from existing `prompt-analyze-v3.ts` response, no new LLM call):
   - **Role** (%) — how strongly the CV evidences candidate IS this role. Aggregate of metric scores for coreSkill + scope + domain.
   - **Keyword Match** (%) — direct from existing `atsKeyword` field + `keywordCoverage.matched.length / (matched+partial+missing)`
   - **Experience** (%) — aggregate of metric scores for seniority + production + impact, role-baseline-anchored
4. **Role-aware 9-dim deep dive** (existing `prompt-analyze-v3.ts` output, but role-grounded)
   - 9 horizontal score bars: Core Skills / Tools / Scope / Production / Domain / Evidence / Seniority / Impact / Communication
   - Each bar shows score + slider override + tiny lens chips ("Recruiter sees:" / "You should know:")
5. **Critical Refactors card** (REUSES current Strengths/Gaps/Recommendations data — NOT a new concept):
   - List of severity-coded items: red ⚠ critical / amber moderate / blue minor
   - Each item: title + 1-line description + action button ("Apply Auto-Refactor →" / "View Suggestions →")

### Step 1b — JD Matching (JD-driven entry)

**Left column** changes: **2 Source cards side-by-side** (Source CV + Source JD)

**Right column:**
1. **Match Score gauge** in dark-blue elevated card: "75%" + "Strong alignment with Senior Product Designer role"
2. **AI Insights card** kế bên: 1 paragraph commentary + 2 priority chips ("High Priority: Accessibility", "Quantify Impact")
3. **Must-Have Requirements card** with "X/N Matched" counter:
   - Per requirement: ✓ matched (green) / ✗ missing (red X)
   - Pulled directly from v0.4 `mustHaves[]` extracted at ingest OR live-parsed from pasted JD
4. **Gap Analysis cards** (Strengths/Gaps/Recs reused under "Gap Analysis" label):
   - Each gap: icon + title + JD→CV linking paragraph + action CTA

### Steps 2-4 — Shared downstream

| Step | Hero | Content cards |
|---|---|---|
| Refined CV | Improvement Delta (e.g. "+12% ATS") | Markdown CV preview + Changes Made + Gaps Remaining + (Phase 3 of LLM plan) 3 interview Qs |
| Roadmap | Feasibility Score (0-100) + realistic/stretch badge | Milestones + Skill Gaps + Next Week Actions + Quick Wins |
| Job Fit | Match distribution (e.g. "3 strong / 5 stretch / 2 reach") | Per-job cards with score + Apply/Skip + recruiterView/selfView (per LLM dual-lens plan) |

## Multi-CV / Multi-JD switching (LOCKED 2026-06-08)

- **CV switching:** BOTH paths
  - `/cvs` library page for browse/manage (rename, delete, set default)
  - Chip-in-header on workflow top bar — dropdown listing user's CVs → switch in place
- **JD switching:** "Import" button on Source JD card → either upload PDF/Word OR paste URL. JDs NOT persisted (one-off per match).
- **CV switching via Import:** Source CV card also has Import button → upload PDF/Word → option to "Replace current CV" OR "Save as new CV in library"

## Entry — Dashboard page (LOCKED)

- Route: `/dashboard` (post-sign-in landing, replaces any /onboarding flow)
- 2 prominent action cards:
  - **"Start CV Analyze →"** — for users wanting CV-solo scoring/refinement
  - **"Start JD Matching →"** — for users with a target JD in hand
- Each click → if user has CVs: opens CV picker; if no CVs: opens "+ New CV" form first
- Below action cards: recent activity list (last 5 analyses across both workflows) for returning users
- First-time + returning users see SAME dashboard. No separate onboarding flow.

## Color & component contract (mostly unchanged)

- Tokens stay (see `cv-ex-refactor/src/app/globals.css` — Material You softened-blue palette, Plus Jakarta Sans + Inter, M3 surface tonal)
- Existing shared components from `src/components/ui/` still consumed (Card, Button, Badge, Slider, Tabs, etc.)
- **New components needed** (Phase 2 + 3):
  - `ChevronStepper` — chevron-arrow nav with `steps[]` + `current` + `onChange`
  - `SourceDocumentCard` — PDF/Word-style render wrapping parsed text
  - `AtsScoreGauge` + `MatchScoreGauge` — circular gauge variants
  - `CriticalRefactorList` — severity-coded item list with inline CTAs
  - `MustHaveChecklist` — checked/missing row list with counter

## Production bugs flagged by ref #4

- Duplicate stacked error blocks on Gemini overload — same error renders twice ("Analysis failed" + "So khớp thất bại"). Fix during Phase 4 implementation (CV Analyze workflow): single ErrorState component per page, not per-block.

## Open decisions tracking — ALL LOCKED 2026-06-08

| # | Decision | Resolution |
|---|---|---|
| 1 | Brand name | **Resume Refactor** |
| 2 | Scoring framing | **Role-fit hero** (Role / Keyword Match / Experience, derived from analyze-v3) + role-aware 9-dim deep dive + Strengths/Gaps reused as Critical Refactors |
| 3 | JD Matching stepper | Separate stepper for JD Matching |
| 4 | CV switcher placement | **BOTH** library page + chip-in-header in workflow |
| 5 | First-time experience | **Dashboard page** with 2 CTA cards (CV Analyze / JD Matching) — no separate onboarding flow |
| 6 | JD/CV swap UX | "Import" button on BOTH Source cards — PDF/Word upload + URL paste (JD only) |
| 7 | Source render data path | UI = formatted PDF-like view; BE value = parsed text string (same as today) |
| 8 | Role-fit metrics compute | **Client-side math aggregation** of analyze-v3 9-dim LLM scores (NOT regex) — `Role = avg(coreSkill+scope+domain)`, `Experience = avg(seniority+production+impact)`, `Keyword Match = atsKeyword field`. Zero quality loss vs LLM. |
| 9 | AI Insights paragraph | **Dedicated new LLM call** — new prompt `src/lib/llm/prompt-jd-insights.ts` + endpoint `POST /api/jd-insights`. Inputs: CV + JD + analyze result. Output: `{ insightsParagraph: string, priorityChips: string[] }`. Called parallel to `/api/analyze` for JD Matching screen (latency = max of both, not sum). +$0.001/session. |
| 10 | Must-Have check | **Semantic match via embeddings** — reuse existing `src/lib/jobs/embed.ts` infra. Embed each mustHave string (Google text-embedding-004, ~$0.00001 each) → cosine similarity vs cached CV embedding chunks → threshold ≥0.65 = matched. Catches "5+ Years UX Experience" → "Spent 7 years designing user experiences" semantic match. ~$0.0001 for 8 must-haves, <100ms compute. |

## References

- `refs/01-target-cv-analyze.png` — user's CV Analyze target
- `refs/02-target-jd-matching.png` — user's JD Matching target
- `refs/03-current-prod-results.png` — current prod state (for comparison)
- `refs/04-bug-duplicate-error.png` — duplicate-error bug to fix during refactor
- `../260608-1235-llm-prompts-dual-lens-redesign/stitch-exports/01-cv-analyze-shell.png` — Stitch exploration (rejected direction, kept for record)
