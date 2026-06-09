# Development Roadmap — ResumeRefine / CVMatching

## Overview

Living document tracking feature phases, milestones, and completion status. Updated after each major phase ships.

---

## v0.1 — Pilot (✓ Shipped 2026-05-27)

**Scope:** Core CV-JD analysis, BYOK vault, shared-key quota, CSP security, admin dashboard.

**Features:**
- Analyze endpoint (Gemini + OpenAI support)
- Rewrite endpoint (career narrative generation)
- BYOK vault (AES-GCM encryption, 4h TTL, httpOnly cookie)
- Anonymous shared-key quota (3 analyze + 1 rewrite/day per IP)
- Admin usage dashboard (`/admin/usage`)
- CSP + HSTS hardening

**Status:** ✓ Shipped to production

---

## v0.2 — Career Path (✓ Shipped 2026-05-28)

**Scope:** Role exploration, roadmap generation, visit counter analytics, quota expansion.

**Features:**
- Career Path auto-suggest (3-5 trajectory options from CV)
- Roadmap generator (milestones, skills gaps, 30/60/90-day quick wins)
- Natural vs targeted mode (auto-infer trajectory or focus area)
- Feasibility check + pragmatic fallback for unrealistic aspirations
- Visit counter badge (unique IP dedup via Redis SADD)
- New quota buckets: `career-path` (2-3/day), `career-path-suggest` (10/min IP rate-limit)

**Status:** ✓ Shipped to production

**Key learnings:**
- LLM roadmap needs higher output token budget (24K tokens to avoid truncation)
- Per-aspiration caching by first 200 chars of CV reduces redundant calls

---

## v0.3 — Job Fit & Study (✓ Shipped 2026-06-02)

**Scope:** Job recommendations with study topics, engagement tracking, hardening, testing, documentation.

**Phases breakdown:**

| Phase | Title | Dates | Status |
|---|---|---|---|
| P0 | Hardening (env vars, cache, cost guard) | May 29 | ✓ |
| P1 | Ingest CLI + 150 seed jobs | May 30–31 | ✓ |
| P2 | `/api/jobs/recommend` endpoint + LLM batch | May 31–Jun 1 | ✓ |
| P3 | UI `/job-fit` + `/job-fit/[jobId]` + sidebar nav | Jun 1–2 | ✓ |
| P4 | Cron refresh + redirect tracking + feedback | Jun 2 | ✓ |
| P5 | Testing + privacy.md + deployment.md + smoke | Jun 2 | ✓ |

**Features:**
- Single-call recommend pipeline: embed CV cache → top-K cosine sim → LLM batch (Gemini Flash) → 9-dim scores + study topics
- Ingest CLI with 150-job seed (80 tech, 30 marketing, 20 finance, 20 sales/ops)
- Daily cron refresh (Vercel Pro, 3am ICT): HEAD/GET source URLs, mark expired, track metrics
- Redirect tracking: `/api/r/[jobId]` increments daily click counters (jobId + date only, no PII)
- Topic dislike feedback: strict schema (no free-text reason), aggregates counters by topic + week
- Cost guard: $1 warn, $3 kill-switch per day; metrics per bucket
- New quota bucket: `job-recommend` (5 anon, 12 signed-in, unlimited BYOK)
- Full privacy & deployment docs (6 sections + KV inventory + rollback procedure)

**Status:** ✓ Shipped to production (Jun 2, 2026)

**Post-ship monitoring (2 weeks):**
- Activation: refined-cv → "Tìm job" CTA click rate ≥ 30%
- Engagement: expand ≥ 1 job detail ≥ 40%
- Topic quality: dislike rate < 15%
- CTR: click "Apply" ≥ 15%
- Cost: < $1/day @ 200 users

---

## v0.3.1 (planned — TBD)

**Scope:** Topic feedback loop tuning, study topic quality improvements.

**Planned features:**
- Dislike feedback aggregation → tune LLM prompt for v0.3.2
- Manual curation of generic/low-value topics
- Per-vertical domain hints (e.g., specific techs for fintech roles)

---

## v0.3.5 (planned — resource links phase)

**Scope:** Add learning resources (YouTube, Udemy, blogs) per study topic.

**Planned features:**
- Curated resource links per topic (defer due to hallucination risk)
- Only enable if topic dislike rate stays < 10%
- Manual review before deployment

---

## v0.3.b (planned — live scraper phase)

**Scope:** Automated job sourcing (playground scrapers, no prod deploy).

**Planned features:**
- Playwright-based iTViec, TopCV, VNW scraper CLI
- Experimental job ingestion pipeline
- No production activation until dataset quality validated

---

## v0.4 — CV-Solo Analyze pivot (✓ Shipped 2026-06-04)

**Scope:** Drop JD requirement from /analyze. LLM infers role from CV; 9-dim scoring rescoped to CV-intrinsic for the claimed role. Must-haves relocate to Job Fit detail. Cover Letter CTA added on Job Fit detail.

**Phases shipped:**
- 1: prompt-analyze-v3.ts CV-solo prompt + 13 unit tests
- 2: 2-stage API route (role-infer → score) + dispatcher + role-infer module
- 3: UI restructure — strip JD/must-haves/role/strictness, role-confirm modal, inferred-role banner
- 4: Must-have block plumbed on Job Fit detail (conditional render until ingest backfills)
- 5: Cover Letter shortcut CTA on Job Fit detail
- 6: Cache version bump v1→v2 + ReAnalyzeBanner
- 7: Memory + docs sync (this entry)

**Status:** ✓ Shipped to main 2026-06-04 (`ea2c6e1` → `4950932`)

**v2 code retained:** prompt-analyze.ts, jd-input-block.tsx, must-haves-block.tsx + AnalyzeInputs schema kept alongside for rollback safety. Hard-delete scheduled after preview env smoke.

**Activation funnel target:** ≥15% lift in `/analyze` completion rate vs v0.3.1 baseline (measured over 2 weeks post-deploy).

**Follow-ups:**
- Ingest enhancement to populate `Job.mustHaves[]` (lights up the conditional block)
- 20-CV role-infer accuracy benchmark (≥85% top-1 at conf ≥ 0.75); tune `ROLE_INFER_CONFIDENCE_THRESHOLD` env if needed

---

## v0.4.x — Resume Refactor IA + UX hardening (✓ Shipped 2026-06-08 / 2026-06-09)

**Scope:** IA refactor (06-08) + Job Fit UX overhaul + auth correctness + prompt direction-setting (06-09).

**Phases shipped:**

- **Resume Refactor IA** (06-08): single sidebar (DashboardSidebar) shared across DashboardLayout + WorkflowLayout; chevron stepper for cv-analyze + jd-matching workflows; persistent layout (cv-analyze/[cvId]/layout.tsx + jd-matching/[cvId]/layout.tsx) so the Source CV iframe persists across step navigation; PDF iframe + bytea storage for original CV; role-fit gauge; 9-dim editable sliders; TipTap rich editor for refined CV; PDF/DOCX/TXT export.
- **JD Matching parallel viewer** (06-08): /match step uses sourceLayout='top' with CV + JD side-by-side; URL reader-view for scraped JD (Readability cleaned HTML); JdImportPanel with paste / URL / file modes; gap-to-source scroll navigation.
- **Workflow stability + JSX tree rules** (06-09): consolidated WorkflowLayout top/left variants into single stable tree; Source CV iframe persists across chevron clicks (no PDF re-fetch).
- **Job Fit UX overhaul** (06-09 — 4 issues bundled): chevron-aware CV pickup (passes cv.content/name from layout), Apply ngay opens external sourceUrl, inline detail expand replacing standalone /job-fit/[id] navigation, B/C tier action labels clarified.
- **Roadmap UX polish** (06-09): per-action error scope, regen button label tracks aspiration change.
- **Auth correctness — CV orphan bug fix** (06-09): NextAuth v5 beta-31 was minting random UUIDs for user.id per OAuth round-trip. Fixed via Google `profile()` override anchoring `user.id = profile.sub` + JWT callback 3-source fallback chain + diagnostic log. ensureUserRow cascade-deletes orphan rows on email-uniq collision.
- **PDF export rewrite** (06-09): window.print → html-to-image + jsPDF (after html2canvas attempt failed on Tailwind v4 oklch).
- **Prompt audit + 9-dim universal labels** (06-09): full audit at `plans/reports/audit-260609-1539-llm-prompts.md` (8 surfaces + 4-phase plan). Phase 1a partial shipped (refined-cv prompt + schema). 9-dim labels universalized — internal keys preserved, prompt + UI labels role-agnostic.
- **Token tracking gaps closed** (06-09): company-enrich added to UsageAction enum + logLlmCall wired; handle-v3 role-infer success path logs; ingest scripts structured stdout. Prerequisite for any per-user billing tier.

**Status:** ✓ Shipped to main. 17 commits (`ad70004` → `3d5ba09`). 469 tests passing / 25 skipped.

**Deferred to next session (priority order):**

1. VN/EN i18n toggle (`next-intl` already in deps, ~12h plan).
2. Phase 1b/1c/1d from prompt audit — Scoring calibration anchors, JD-match v2 distinct coverage + role mismatch flag + drop `strictness=friendly`, Cover Letter 4 tone variants.
3. Phase 2 — Roadmap prompt-only fixes (keep `gemini-2.0-flash`; defer model bump).
4. Refined CV aspiration UI (Phase 1a schema shipped; UI field + auto-flow from Career Path store deferred).
5. Job Fit dim rebalance (`location` often empty → score noise). Defer until non-tech audience grows.
6. Pricing rollout — blocked until VN/EN ships + token tracking stable for ≥1 week.

---

## v0.5 (future)

**Scope:** Authentication maturity, persistent history, auto-pipeline (daily-score + email digest).

**Planned features:**
- Google OAuth sign-in mainstreamed (UI currently hidden, auth service ready)
- Persistent job application history + saved notes per job
- Onboarding step for desired role + criteria (location, salary band, vertical)
- Daily cron scoring fresh jobs against user CV + desired role
- "Quick win" email digest (3-5/week, Resend integration, opt-in, unsubscribe)
- LLM-generated quiz per study topic (if signal strong from dislike feedback)
- Custom topic CRUD (admin power-users)

---

## Known risks & mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM batch hallucinate generic study topics | M | Dislike feedback loop → tune prompt v0.3.1 |
| Job pool stale (21d TTL) | L | Daily cron refresh + manual reseed runbook |
| Cron schedule typo → no refresh runs | L | `vercel.ts` type-check + post-deploy manual verify |
| Cost spike (abuse / model regression) | M | Kill-switch at $3/day + alert webhook |
| ToS pushback from ITviec/TopCV | M | Seed phase = manual paste (defensible); v0.3.b scrapers TBD with legal review |
| `ADMIN_USER_IDS` unset → dashboard open | H | Block ship if env missing (Phase 0 gate) |

---

## Success metrics summary

**v0.1 & v0.2:** Shipped and stable. Pilot baseline metrics: 500+ monthly users, <$1/day cost.

**v0.3 (target for 2-week post-ship monitoring):**
- Activation: 30% (refined-cv users click "Tìm job")
- Engagement: 40% (expand ≥1 detail page)
- Quality: dislike <15%, CTR 15%, cost <$1/day @ 200 users

---

## Contributing

To update this roadmap:
1. After feature ships, update status and dates
2. Reflect learnings in "Key learnings" section
3. Reprioritize future phases based on success metrics
4. Maintain "Open issues" list in plan files under `plans/` directory
