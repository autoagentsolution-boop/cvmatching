# Phase 01 — Project Setup

## Context

- **Brainstorm:** [../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md](../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md)
- **Source HTML:** `../../cv_fit_scoring_app.html`
- **Priority:** P0 (blocks all phases)
- **Status:** pending
- **Estimated effort:** 2-3 hours

## Overview

Scaffold Next.js 15 + TypeScript + Tailwind project. Setup dependencies, environment variables structure, Vercel project link, baseline routing. Lay foundation cho mọi phase sau.

## Key Insights

- Vercel Hobby tier: Edge 25s, Node 10s, KV 30K commands/day free
- Next.js 15 App Router là default — RSC + Route Handlers
- TS strict mode bật ngay từ đầu để tránh tech debt
- ESLint + Prettier minimal config — không over-engineer

## Requirements

### Functional
- Next.js 15 project chạy local `pnpm dev`
- Health check route `/api/health` trả `{ ok: true }`
- Tailwind compile + Inter font load
- Env vars sample file `.env.example`

### Non-functional
- TS strict
- `.gitignore` exclude `.env*`, `node_modules`, `.next`, `.vercel`
- Repo readme với setup instructions

## Architecture

```
cv-ex-refactor/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, Inter font, metadata
│   │   ├── page.tsx                # Stub homepage (filled Phase 03)
│   │   ├── globals.css             # Tailwind imports + design tokens
│   │   └── api/
│   │       └── health/
│   │           └── route.ts        # GET → { ok: true }
│   ├── lib/
│   │   ├── env.ts                  # Zod-validated env loader
│   │   └── design-tokens.ts        # Port từ HTML CSS vars
│   └── types/
│       └── index.ts                # Shared types
├── .env.example
├── .env.local                      # Local secrets (gitignored)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Related Code Files

### Create
- `package.json` — deps + scripts
- `tsconfig.json` — strict TS
- `next.config.ts` — runtime config
- `tailwind.config.ts` — design tokens từ HTML cũ
- `src/app/layout.tsx` — root layout
- `src/app/page.tsx` — stub
- `src/app/globals.css` — Tailwind + tokens
- `src/app/api/health/route.ts` — health check
- `src/lib/env.ts` — Zod env loader
- `src/lib/design-tokens.ts` — color/spacing constants
- `.env.example`
- `.gitignore`
- `README.md`

### Read for context
- `cv_fit_scoring_app.html` lines 7-141 (CSS variables, design tokens)

## Implementation Steps

1. **Init project**
   ```bash
   pnpm create next-app@latest cv-ex-refactor --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint
   cd cv-ex-refactor
   ```
   Manually add ESLint flat config sau (next-app default flag conflict).

2. **Install runtime deps**
   ```bash
   pnpm add zod zustand next-intl next-auth@beta @auth/core
   pnpm add @vercel/kv
   pnpm add @mozilla/readability jsdom unpdf mammoth
   pnpm add react-markdown remark-gfm
   pnpm add react-icons              # Material Symbols via react-icons/md
   ```

3. **Install dev deps**
   ```bash
   pnpm add -D @types/jsdom eslint @eslint/js typescript-eslint prettier
   ```

4. **Configure `tsconfig.json` strict mode**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "exactOptionalPropertyTypes": true
     }
   }
   ```

5. **Port design tokens từ Stitch DESIGN.md** (`CVEXRefactor/stitch_ai_resume_optimizer/precision_career_interface/DESIGN.md`) vào `tailwind.config.ts`:
   ```ts
   theme: {
     extend: {
       colors: {
         // Stitch palette — Soft UI / Modern Minimalist
         surface: '#f7f9fb',
         'surface-container-lowest': '#ffffff',
         'surface-container-low': '#f2f4f6',
         'surface-container': '#eceef0',
         'on-surface': '#191c1e',
         'on-surface-variant': '#45464d',
         outline: '#76777d',
         'outline-variant': '#c6c6cd',
         primary: '#000000',           // Deep navy/black brand
         'on-primary': '#ffffff',
         'primary-container': '#131b2e',
         secondary: '#006e2f',         // Success green
         'on-secondary': '#ffffff',
         'secondary-container': '#6bff8f',
         tertiary: '#3980f4',          // Action blue (links/CTAs)
         'tertiary-container': '#001a42',
         error: '#ba1a1a',
         'error-container': '#ffdad6',
       },
       borderRadius: { DEFAULT: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' },
       boxShadow: {
         soft: '0 20px 40px -5px rgba(15, 23, 42, 0.08)',
         'ghost-border': '0 0 0 1px #c6c6cd',
       },
       fontFamily: {
         display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
         body: ['Inter', 'system-ui', 'sans-serif'],
       },
     },
   }
   ```
   **Font loading**: Add Plus Jakarta Sans + Inter qua `next/font/google` trong `layout.tsx`.
   **Icons**: Material Symbols Outlined CDN trong `<head>` hoặc `react-icons/md` (npm) — choose `react-icons/md` để tree-shake.

6. **Create `src/lib/env.ts`** Zod loader cho server-only env:
   ```ts
   import { z } from 'zod';
   const schema = z.object({
     GEMINI_API_KEY: z.string().optional(),
     OPENAI_API_KEY: z.string().optional(),
     NEXTAUTH_SECRET: z.string().min(32),
     GOOGLE_CLIENT_ID: z.string(),
     GOOGLE_CLIENT_SECRET: z.string(),
     KV_REST_API_URL: z.string().url(),
     KV_REST_API_TOKEN: z.string(),
     NEXTAUTH_URL: z.string().url().optional(),
   });
   export const env = schema.parse(process.env);
   ```
   **Important:** Chỉ import file này từ server code. KHÔNG bao giờ import từ client component.

7. **Create `.env.example`** với placeholder rỗng cho mọi key trong schema.

8. **Create `src/app/api/health/route.ts`**
   ```ts
   export const runtime = 'edge';
   export async function GET() {
     return Response.json({ ok: true, ts: Date.now() });
   }
   ```

9. **Setup root layout với metadata + Inter font**
   ```ts
   // src/app/layout.tsx
   import { Inter } from 'next/font/google';
   import './globals.css';
   const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
   export const metadata = {
     title: 'CV-EX Refactor',
     description: 'LLM-powered CV ↔ JD matching và recommendations',
   };
   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return <html lang="vi"><body className={inter.variable}>{children}</body></html>;
   }
   ```

10. **Vercel link**
    ```bash
    pnpm dlx vercel link
    ```
    Tạo project mới hoặc link vào existing.

11. **Smoke test**
    ```bash
    pnpm dev
    curl http://localhost:3000/api/health
    ```
    Expected: `{"ok":true,"ts":...}`

## Todo List

- [ ] Init Next.js project với flags chuẩn
- [ ] Install runtime deps (next-auth, zod, zustand, etc.)
- [ ] Install dev deps (ESLint, prettier, types)
- [ ] Configure `tsconfig.json` strict mode
- [ ] Port design tokens HTML → `tailwind.config.ts`
- [ ] Tạo `src/lib/env.ts` với Zod validation
- [ ] Tạo `.env.example` + add `.env.local` vào `.gitignore`
- [ ] Tạo `/api/health` route
- [ ] Setup root layout + Inter font
- [ ] `vercel link` để bind Vercel project
- [ ] Smoke test: `pnpm dev` + curl health
- [ ] Commit baseline với conventional message

## Success Criteria

- ✅ `pnpm dev` start không error
- ✅ `pnpm build` thành công
- ✅ `curl localhost:3000/api/health` trả 200 + JSON
- ✅ Tailwind classes apply trên `page.tsx` stub
- ✅ Inter font load (check DevTools Network)
- ✅ `pnpm tsc --noEmit` không error
- ✅ Vercel project linked (`.vercel/project.json` tồn tại)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Next.js 15 RC issues | Low | Med | Pin minor version, có rollback Next.js 14 path |
| Vercel KV provisioning fail | Low | Low | Defer KV setup sang Phase 07 nếu cần |
| ESLint flat config phức tạp | Med | Low | Bắt đầu minimal config, mở rộng sau |

## Security Considerations

- `.env.local` trong `.gitignore` từ commit đầu tiên
- `NEXTAUTH_SECRET` min 32 chars (Zod enforce)
- Không bao giờ log `env` object full
- `src/lib/env.ts` không expose ra `next.config.ts` runtime-public

## Next Steps

- **Phase 02** (Authentication) start ngay sau khi baseline xanh
- **Phase 03** (UI Port) có thể start parallel với 02 (file ownership khác nhau)
