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

## v0.4 (future)

**Scope:** Authentication, persistent job history, interactive quiz (re-evaluation).

**Planned features:**
- Google OAuth sign-in (UI currently hidden, auth service ready)
- Persistent job application history + saved notes per job
- LLM-generated quiz per study topic (if signal strong from dislike feedback)
- Job alert email digest
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
