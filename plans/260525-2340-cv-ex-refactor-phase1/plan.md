---
name: cv-ex-refactor-phase1
title: CV-EX Refactor — Phase 1
status: pending
created: 2026-05-25
owner: vinh2000ld11@gmail.com
blockedBy: []
blocks: []
---

# CV-EX Refactor — Phase 1

Web app full-stack từ `cv_fit_scoring_app.html` với 2 mode: shared-key (auth + quota) và BYOK (guest). JD ingest từ URL/file/paste. Hard requirement: shared key không bao giờ rời server.

## Context

- **Logic source:** `cv_fit_scoring_app.html` (1037 LOC) — port LLM/state logic
- **Design source:** `CVEXRefactor/stitch_ai_resume_optimizer/` (Stitch AI mockups + DESIGN.md)
- **Brand:** ResumeRefine (đã rebrand từ CV-EX Refactor — match design)
- **Brainstorm report:** [../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md](../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md)
- **Stack:** Next.js 15 + TS + Tailwind + Vercel Hobby
- **Auth:** Auth.js v5 + Google OAuth (email magic link defer Phase 2)
- **Storage:** Vercel KV (quota only, no content)
- **Scope decision:** **Option A** — apply Stitch visual layer + sidebar shell. Tabs History/Optimizations/Career Path stub "Coming soon". No DB, no Pro tier, no PDF download Phase 1.

## Phases

| # | Phase | Status | Depends on |
|---|-------|--------|-----------|
| 01 | [Project Setup](phase-01-project-setup.md) | pending | — |
| 02 | [Authentication](phase-02-authentication.md) | pending | 01 |
| 03 | [UI Port — Index](phase-03-ui-port.md) | pending | 01 |
| 03a | [Design Tokens + Shared UI](phase-03a-design-tokens-shared-ui.md) | pending | 01 |
| 03b | [Layout Templates](phase-03b-layout-templates.md) | pending | 03a |
| 03c | [Feature Pages (4 screens + 3 stubs)](phase-03c-feature-pages.md) | pending | 03a, 03b |
| 04 | [File Parsing API](phase-04-file-parsing-api.md) | pending | 01 |
| 05 | [URL Scraping API](phase-05-url-scraping-api.md) | pending | 01 |
| 06 | [LLM Endpoints](phase-06-llm-endpoints.md) | pending | 01, 02 |
| 07 | [Quota & Rate Limiting](phase-07-quota-rate-limiting.md) | pending | 02, 06 |
| 08 | [i18n + Security + Deploy](phase-08-i18n-security-deploy.md) | pending | 03c, 06, 07 |

## Key Dependencies

- **External services:** Google Cloud Console (OAuth client), Vercel account, Vercel KV, Gemini/OpenAI API keys
- **Critical path:** 01 → 02 → 06 → 07 → 08
- **Parallelizable:** 03a → 03b → 03c (internal sub-phases each parallel-able) || 04 (parse) || 05 (scrape) after 01
- **UI sub-phase ordering:** 03a (tokens + shared UI) blocks 03b (layouts) blocks 03c (feature pages). Within 03a, components parallelize after tokens commit. Within 03c, the 4 screens parallelize after 03b done.

## Success Criteria

- Shared API key zero leak (verify: grep client bundle, audit logs, response payloads)
- Anonymous BYOK end-to-end works without login
- Authed shared-key user: 5 analyses + 2 rewrites/day, quota counter accurate, resets 00:00 UTC+7
- JD scrape works trên ≥4/5 job board VN phổ biến
- PDF/DOCX upload parse ≥90% file <4MB
- VN UI default, EN toggle working
- Production deploy Vercel, custom subdomain optional

## Out of Scope (Phase 2+)

History page + DB, Career Path tab, Optimizations tab (riêng), Predictive Interview Questions, PDF download refined CV, Pro tier/billing, email magic link, multi-CV compare, resume builder, team sharing, mobile native, JS-render scraping, analytics dashboard.

## Stub UI Phase 1

Sidebar nav theo Stitch design có 4 tabs: **Analyze** (active), **History** / **Optimizations** / **Career Path** (stub "Coming soon" overlay). Giữ visual consistency, không break user expectation khi scale Phase 2.
