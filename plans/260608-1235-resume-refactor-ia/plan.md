# Resume Refactor — IA Refactor + Multi-CV Storage

**Created:** 2026-06-08
**Status:** Design locked, implementation NOT started
**Estimated effort:** ~5-7 days across 6 phases
**Supersedes:** memory `plan_ui_ux_ia_refactor` Phase 2/3/4 (consolidated into this plan)

## Why

User-provided references (`refs/01-target-cv-analyze.png` + `refs/02-target-jd-matching.png`) define a clean product vision:
- App brand **Resume Refactor** with thin icon sidebar
- **Chevron stepper** (not tabs) per workflow: linear value journey
- **Source Document panel** always visible alongside results
- **2 entry workflows** (CV Analyze, JD Matching) sharing last 3 downstream steps (Refined CV, Roadmap, Job Fit)
- **Multi-CV storage** with auth-gated CRUD

Full spec → `design-intent.md`.

## Success criteria

After 6 phases ship:
1. Brand visibly "Resume Refactor" across app shell
2. Signed-in user can create, edit, switch, delete multiple CVs from `/cvs` library
3. From a selected CV, user enters CV Analyze OR JD Matching with chevron stepper visible
4. Source Document rendered as PDF/Word-style page (not raw textarea), with zoom + fullscreen
5. Each step shows step-appropriate hero score + action cards
6. Refined CV / Roadmap / Job Fit accept optional `jdId` for JD-tailored vs CV-solo modes
7. Old `/career-path`, `/refined-cv`, `/job-fit` top-level routes redirect to new sub-paths
8. Duplicate-error bug (`refs/04-bug-duplicate-error.png`) fixed

## Phases (compact summary — expand to separate files when execution starts)

| # | Phase | Effort | Risk | Blocks |
|---|---|---|---|---|
| 1 | **Data layer — multi-CV** | 1d | Low | All downstream — must ship first |
| 2 | **App shell — Resume Refactor brand + chevron stepper** | 1-2d | Medium | Workflow pages need shell |
| 3 | **Source Document render** | 1-2d | Medium-High (novel component) | All workflow steps |
| 4 | **CV Analyze workflow content** | 1d | Low (mostly UI reshape over existing API) | — |
| 5 | **JD Matching workflow content** | 1d | Low | Requires Phase 2 shell + Phase 3 source render |
| 6 | **Shared downstream sub-steps refactor** | 0.5-1d | Medium (routing migration) | All other phases |

### Phase 1 — Data layer (multi-CV) + Import infrastructure

**Data layer:**
- New Drizzle migration: `user_cvs` table — `id`, `user_id` (FK), `name`, `content` (text), `is_default` (bool), `created_at`, `updated_at`
- Auth-gated CRUD endpoints under `src/app/api/cvs/`:
  - `GET /api/cvs` — list current user's CVs
  - `POST /api/cvs` — create
  - `PATCH /api/cvs/[id]` — rename / set-default / replace content
  - `DELETE /api/cvs/[id]` — soft-delete or hard-delete (decide during phase)
- Anonymous users: 1 ephemeral CV in localStorage (no auth = no library, no multi-CV)
- Tests: integration test against real Neon dev (per memory `feedback_single_env_production_only` — no mocks)
- Files: `src/db/schema.ts`, `drizzle/<timestamp>_user_cvs.sql`, `src/app/api/cvs/**/route.ts`, `src/lib/cvs/repo.ts`, related Zod schemas

**Import infrastructure (LOCKED — Import button on Source CV/JD cards):**
- First task: AUDIT existing codebase for PDF/Word parsers (user belief: already exists; verify before building)
- PDF parser: `pdf-parse` package (likely already in deps for current CV upload UX)
- DOCX parser: `mammoth` package — extract text from .docx
- JD URL scrape: reuse listing-detail extractors from `scripts/ingest-topcv.ts` + `ingest-itviec.ts`. Wrap into single helper `src/lib/jd-import/scrape-jd-from-url.ts`
- Upload endpoint: `POST /api/import/cv` (file → parsed text → optional save to user_cvs) + `POST /api/import/jd` (file or URL → parsed text → returned, NOT persisted)
- Size limits + MIME validation + virus-scan TBD
- Files: `src/lib/parse/parse-pdf.ts`, `src/lib/parse/parse-docx.ts`, `src/lib/jd-import/scrape-jd-from-url.ts`, `src/app/api/import/cv/route.ts`, `src/app/api/import/jd/route.ts`

### Phase 2 — App shell + chevron stepper + Dashboard

- Rename brand: app title, sidebar logo, page metadata. Search-and-replace `CVMatching` → `Resume Refactor` carefully (commit msgs + memory NOT changed)
- New `ChevronStepper` shared component under `src/components/ui/chevron-stepper.tsx` (target ≤180 LOC)
- New `CvPickerChip` shared component under `src/components/ui/cv-picker-chip.tsx` — pill chip with dropdown list of user's CVs + "+ New" + "Manage" link
- Refactor `DashboardLayout` / `DashboardSidebar` → thin icon sidebar variant (or new `WorkflowLayout` template). Sidebar adds **Dashboard** icon top
- New routes (LOCKED):
  - `/dashboard` — post-sign-in landing, 2 action cards (CV Analyze / JD Matching) + recent activity list
  - `/cv-analyze/[cvId]/[step]` — workflow shell, step ∈ {score, refined, roadmap, jobfit}
  - `/jd-matching/[cvId]/[step]` — same, step ∈ {match, refined, roadmap, jobfit}
  - `/cvs` — library page (browse + manage all user CVs)
- Redirects for old routes:
  - `/` (signed-in) → `/dashboard`
  - `/analyze` → `/cv-analyze/[defaultCvId]/score`
  - `/jd-matching` (old) → `/jd-matching/[defaultCvId]/match`
  - `/career-path`, `/refined-cv`, `/job-fit` → corresponding sub-step under active workflow
- Files: `src/components/ui/chevron-stepper.tsx`, `src/components/ui/cv-picker-chip.tsx`, `src/components/layouts/workflow-layout.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/cv-analyze/**`, `src/app/(app)/jd-matching/**`, `src/app/(app)/cvs/page.tsx`, dashboard sidebar updates

### Phase 3 — Source Document render

- New `SourceDocumentCard` component — accepts parsed text + optional `documentType` (cv/jd) → renders as styled HTML mimicking PDF page layout
- Strategy: NOT a real PDF viewer (heavy + parsing-dependent). Instead — Markdown-render the parsed text with CSS shaped like a Word doc (white page, shadow, max-width 8.5in, typography matching real CV templates)
- Section detection: regex-segment by common headers (Experience / Skills / Education) → render with appropriate styling
- Zoom: CSS `transform: scale()` with state, 75% / 100% / 125% / 150%
- Fullscreen: dialog/modal overlay
- Edit: passes to drawer (handled by parent)
- Files: `src/components/ui/source-document-card.tsx`, `src/components/ui/source-document-page.tsx` (sub-component for the visual page), associated styles

### Phase 4 — CV Analyze workflow content

- Reuse existing `/api/analyze` (no API change in this phase — content is reshape)
- New `RoleFitGauge` (circular gauge, blue arc, role-anchored) + 3 role-fit metric bars (LOCKED):
  - **Role** — aggregate of analyze-v3 metrics: `(coreSkill + scope + domain) / 3`
  - **Keyword Match** — direct from `atsKeyword` field OR `keywordCoverage.matched.length / (matched+partial+missing)`
  - **Experience** — aggregate of analyze-v3 metrics: `(seniority + production + impact) / 3`
- ALL metrics computed CLIENT-SIDE from existing v3 response (no new LLM call)
- 9-dim deep dive: render existing analyze response (no LLM change)
- "Critical Refactors" card = render existing Strengths/Gaps/Recommendations with new visual contract (severity icon + inline CTA button)
- Fix duplicate-error bug (`refs/04-bug-duplicate-error.png`) — single ErrorState wrapper instead of multiple inline error blocks
- Files: `src/features/cv-analyze/**` (new), `src/lib/scoring/role-fit-aggregate.ts` (new aggregation helper), reusing `src/lib/llm/normalize-analyze-v3.ts`

### Phase 5 — JD Matching workflow content

- Reuse existing `/api/analyze` (v2 dispatch) + `/api/jobs/recommend`
- New `MatchScoreGauge` (dark-blue variant)
- **AI Insights card — DEDICATED LLM call (LOCKED)**:
  - New prompt: `src/lib/llm/prompt-jd-insights.ts` — input: CV + JD + analyze result; output: `{ insightsParagraph: string (1-2 sentences synthesis), priorityChips: string[] (1-3 priority labels) }`
  - New endpoint: `POST /api/jd-insights`
  - Normalize: `src/lib/llm/normalize-jd-insights.ts` with Zod schema
  - Client calls in parallel with `/api/analyze` → latency = max(both), not sum
  - Estimated +$0.001/session, +~3s parallel latency (absorbed by analyze)
  - Brutal tone rule applied (locked in `plan_llm_prompts_dual_lens`)
- **Must-Have check — SEMANTIC via embeddings (LOCKED)**:
  - Reuse `src/lib/jobs/embed.ts` (Google text-embedding-004)
  - New helper: `src/lib/jd-matching/check-musthaves-semantic.ts` — embed each mustHave, cosine similarity vs CV embedding chunks (chunked by section: experience/skills/education)
  - Threshold ≥0.65 = matched, 0.45-0.65 = partial, <0.45 = missing
  - CV embedding cached (existing); only must-haves are fresh-embedded per check (~$0.0001 for 8 items)
  - Returns `{ requirement: string, status: 'matched'|'partial'|'missing', score: number, evidenceSnippet?: string }[]`
  - UI counter "X/N Matched" displays only `matched` count
- Gap Analysis cards — same as CV Analyze's Critical Refactors but framed against JD requirements
- "Apply Auto-Refactor →" CTA → links to `/jd-matching/[cvId]/refined`
- Files: `src/features/jd-matching/**` (new), `src/lib/llm/prompt-jd-insights.ts` (new), `src/lib/llm/normalize-jd-insights.ts` (new), `src/app/api/jd-insights/route.ts` (new), `src/lib/jd-matching/check-musthaves-semantic.ts` (new), reusing analyze/recommend logic

### Phase 6 — Shared downstream sub-steps

- Route migration: `/career-path` → `/[workflow]/[cvId]/roadmap`, etc.
- Each downstream component (`features/refined-cv`, `features/career-path`, `features/job-fit`) accepts new prop `mode: 'cv-solo' | 'jd-context'` + optional `jdContext`
- BE: prompt builders already support both modes (per `design-intent.md`); just plumb correctly
- Old top-level route files → redirect-only stubs (kept 1 release for backwards compat, deleted next release)
- Files: `src/features/refined-cv/**`, `src/features/career-path/**`, `src/features/job-fit/**`, route stubs

## Cross-references

- Design contract: `./design-intent.md`
- LLM prompts redesign plan (separate, deferred): `../260608-1235-llm-prompts-dual-lens-redesign/`
- Active backend plan: `../260606-1231-jobfit-db-pool-monetize/`
- Memory: `plan_ui_ux_ia_refactor` (superseded — to update), `feedback_ui_ux_design_system` (mandatory contract)

## Open decisions — ALL LOCKED 2026-06-08

| # | Decision | Resolution |
|---|---|---|
| 1 | Brand | **Resume Refactor** |
| 2 | Scoring framing | **Role-fit hero** (Role / Keyword Match / Experience, derived from analyze-v3) + role-aware 9-dim deep dive + Strengths/Gaps reused as Critical Refactors |
| 3 | JD Matching stepper | **Separate** from CV Analyze |
| 4 | CV switcher placement | **BOTH** library page + chip-in-header in workflow |
| 5 | First-time experience | **Dashboard page** with 2 action cards (no separate /onboarding) |
| 6 | JD/CV swap UX | **"Import" button on BOTH Source cards** — PDF/Word upload + URL paste (JD only) |
| 7 | Source render data path | UI = PDF-like view; BE value = parsed text string (same as today) |
| 8 | Role-fit metrics compute | **Client-side math aggregation** of analyze-v3 9-dim LLM scores (Role / Keyword Match / Experience) |
| 9 | AI Insights paragraph | **Dedicated LLM call** — new `/api/jd-insights` + `prompt-jd-insights.ts`. Parallel to analyze. +$0.001/session. |
| 10 | Must-Have check | **Semantic via embeddings** — reuse existing embed infra + cosine similarity. ~$0.0001/check. |

## Cost/risk notes

- 5-7 days estimated; can ship in pieces (Phase 1 + 2 alone unblocks anyone)
- Pilot stays CLOSED throughout — refactor lands while pool stays at 332 and login flag stays off
- After Phase 4 + 5 ship + visual QA, can reopen pilot
- Memory `feedback_ui_ux_design_system` pre-finalization scan mandatory before declaring any phase DONE
