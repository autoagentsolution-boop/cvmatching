# ResumeRefine — AI Career Copilot

LLM-powered CV ↔ JD matching, scoring, and refinement.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Health check

```bash
curl http://localhost:3000/api/health
# {"ok":true,"ts":<epoch-ms>}
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

See `.env.example` for all required keys. Refer to Phase 02 docs for Auth.js and KV setup.

## Architecture

Implementation plan: [`../plans/260525-2340-cv-ex-refactor-phase1/`](../plans/260525-2340-cv-ex-refactor-phase1/plan.md)

```
src/
├── app/
│   ├── api/health/route.ts   # Edge health check
│   ├── layout.tsx            # Root layout + fonts
│   ├── page.tsx              # Stub homepage (Phase 03)
│   └── globals.css           # Tailwind v4 @theme tokens
└── lib/
    └── env.ts                # Zod-validated server env
```

## Tech stack

- Next.js 16 (App Router) + TypeScript strict
- Tailwind CSS v4 (CSS-first @theme tokens)
- Zod · Zustand · next-auth v5 beta
- Gemini / OpenAI (Phase 04+)
