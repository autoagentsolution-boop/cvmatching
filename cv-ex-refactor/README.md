# ResumeRefine — AI Career Copilot

LLM-powered CV ↔ JD matching, scoring, and refinement. Vietnamese-first; English on toggle.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in keys (see below)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Health check:
```bash
curl http://localhost:3000/api/health
```

## Modes

| Mode | Setup | Use when |
|---|---|---|
| **BYOK** (default) | User pastes their own Gemini/OpenAI key in Settings | Local dev, low-friction trials, privacy-sensitive |
| **Shared key** | Server has `GEMINI_API_KEY` or `OPENAI_API_KEY` + user signs in with Google | Quota-controlled team/free-tier offering |

Both paths work side-by-side. Shared-key is rate-limited (5 analyses + 2 rewrites/day per user). BYOK is unrate-limited (user's own provider account).

## Environment variables

See [`.env.example`](./.env.example) for the full list with inline docs. Required for production:

- `GEMINI_API_KEY` and/or `OPENAI_API_KEY` (shared-key path)
- `AUTH_SECRET` (Auth.js — `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (for sign-in)
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Vercel KV — quota + rate limit)

Optional kill switch: `DISABLE_SHARED_KEY=1` forces shared-key path to 503 (users keep BYOK). Use if shared keys get abused.

## Architecture

Implementation plan: [`../plans/260525-2340-cv-ex-refactor-phase1/`](../plans/260525-2340-cv-ex-refactor-phase1/plan.md)

```
src/
├── app/
│   ├── (app)/             # Authed routes (analyze, refined-cv, history stubs)
│   ├── (auth)/sign-in     # OAuth entry
│   ├── api/
│   │   ├── parse/         # PDF/DOCX/TXT → text (Node, 10s, 4MB cap)
│   │   ├── scrape/        # URL → JD text via Readability (Node, 10s, SSRF guarded)
│   │   ├── analyze/       # CV+JD → AnalysisResult JSON (Node, 60s)
│   │   ├── generate-cv/   # Refined CV markdown
│   │   ├── extract-must-haves/
│   │   ├── quota/         # GET daily quota status
│   │   ├── auth/[...nextauth]/
│   │   └── health/
│   └── globals.css
├── components/             # Shared design-system primitives
├── features/
│   ├── analyze/            # CV input, JD input, parameters, must-haves
│   ├── results/            # Match score, gaps, recs, keyword coverage
│   ├── refined-cv/         # Markdown view, download
│   └── nav/                # App shell, quota badge
└── lib/
    ├── parsers/            # PDF/DOCX magic-byte + extractors
    ├── scrape/             # URL validation, fetch, Readability
    ├── llm/                # Provider callers, prompts, normalizer
    ├── scoring/            # Client-side recompute from 9-dim metrics
    └── quota/              # KV-backed quota + IP rate limit
```

## Scoring model

The 9 sliders (`coreSkill`, `tool`, `scope`, `production`, `domain`, `evidence`, `seniority`, `impact`, `communication`) are **LLM-scored CV-vs-JD match per dimension**, not recruiter-set weights. After analysis the user can override individual values; `overallScore` recomputes client-side as `round(mean(scores))`. Recommendations, gaps, keyword coverage, and red flags stay frozen as LLM output.

Decision thresholds (recomputed live): 75+ Strong · 55+ Good · 35+ Stretch · else Low.

## Deploy

See [`../docs/deployment.md`](../docs/deployment.md) for the step-by-step Vercel guide (env vars, OAuth callback, KV provisioning, smoke tests).

Quick:
```bash
pnpm dlx vercel --prod
```

## Tech stack

- Next.js 16 (App Router, Turbopack) + TypeScript strict
- Tailwind CSS v4 (CSS-first `@theme` tokens) + Radix primitives
- Zod · Zustand · Auth.js v5 (Google OAuth)
- Vercel KV (Upstash Redis) — quota + IP rate limit
- Gemini · OpenAI · OpenAI-compatible custom baseUrl

## Limits (Phase 1)

- File upload ≤ 4 MB
- PDF/DOCX scan-only (image PDFs) not supported — paste text instead
- LinkedIn/Indeed direct scrape often hits anti-bot — paste JD instead
- Shared key quota resets 00:00 Asia/Bangkok daily
- IP rate limit on `/api/parse` + `/api/scrape`: 30 req/min/IP
