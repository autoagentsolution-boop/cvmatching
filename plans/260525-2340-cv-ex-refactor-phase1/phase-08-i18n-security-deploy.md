# Phase 08 — i18n + Security Hardening + Deploy

## Context

- **Brainstorm:** [../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md](../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md)
- **Priority:** P0 (final)
- **Status:** pending
- **Depends on:** Phase 03 (UI), Phase 06 (LLM), Phase 07 (quota)
- **Estimated effort:** 4-5 hours

## Overview

3 sub-tasks bundled vào phase cuối:

1. **i18n** — wrap UI text với `next-intl`, vi default + en toggle
2. **Security audit** — verify hard requirements (no shared key leak), secret scan
3. **Production deploy** — Vercel production env, OAuth prod callback, custom domain optional, smoke test

## Key Insights

- **next-intl** App Router native, server-side render translations
- Locale strategy: route prefix `/vi/*` `/en/*` thêm complexity → Phase 1 chọn **single-locale với toggle context-based** (cookie/localStorage), không route prefix
- Security audit phải làm **trước** deploy production
- Vercel production deploy = `vercel --prod` hoặc git push main + auto-deploy

## Requirements

### Functional (i18n)
- Mọi UI string wrap `t('key')`
- 2 locale files: `messages/vi.json`, `messages/en.json`
- Toggle button trong header → switch locale → persist cookie
- Server component dùng `getTranslations()`, client dùng `useTranslations()`
- Locale fallback: vi nếu missing key trong en (rare)

### Functional (deploy)
- Production env vars set trên Vercel
- Google OAuth callback prod URL added
- Vercel KV linked production
- Smoke test: BYOK flow + shared flow end-to-end
- README có deploy instructions

### Non-functional (security)
- Zero leak: shared `GEMINI_API_KEY` / `OPENAI_API_KEY`
- Audit checklist pass (xem dưới)
- No secrets committed (gitleaks scan)

## Architecture

```
i18n flow:
  Cookie 'NEXT_LOCALE' = 'vi' | 'en'
   │
   ▼
  Next.js Server Component → getLocale() từ cookie
   │
   ▼
  getTranslations() → render với locale strings
   │
   ▼
  Client toggle button → setCookie + router.refresh()
```

## Related Code Files

### Create
- `src/i18n/request.ts` — next-intl config
- `src/i18n/locale.ts` — getLocale/setLocale helpers
- `messages/vi.json` — Vietnamese strings (default)
- `messages/en.json` — English strings
- `src/components/layout/locale-toggle.tsx` — UI toggle
- `docs/deployment.md` — production deploy guide
- `README.md` (root) — final README

### Modify
- Tất cả components từ Phase 03 — wrap strings với `t()`
- `src/app/layout.tsx` — add `NextIntlClientProvider`
- `next.config.ts` — add `next-intl` plugin
- API route error messages — convert sang i18n keys hoặc locale-aware

## Implementation Steps

### Part A — i18n (~2h)

1. **Install + plugin**
   ```bash
   pnpm add next-intl
   ```
   `next.config.ts`:
   ```ts
   import createNextIntlPlugin from 'next-intl/plugin';
   const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
   export default withNextIntl({ /* existing config */ });
   ```

2. **`src/i18n/request.ts`**
   ```ts
   import { getRequestConfig } from 'next-intl/server';
   import { cookies } from 'next/headers';

   export default getRequestConfig(async () => {
     const cookieStore = await cookies();
     const locale = (cookieStore.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'vi') as 'vi' | 'en';
     return {
       locale,
       messages: (await import(`../../messages/${locale}.json`)).default,
     };
   });
   ```

3. **`messages/vi.json`** — example structure
   ```json
   {
     "app": {
       "title": "CV-EX Refactor",
       "tagline": "Phân tích CV ↔ JD bằng LLM, gợi ý kiến thức cần bổ sung"
     },
     "settings": {
       "useSharedKey": "Dùng shared key (cần đăng nhập)",
       "useByok": "Dùng key của tôi",
       "provider": "Provider",
       "model": "Model",
       "apiKey": "API Key",
       "save": "Lưu cấu hình"
     },
     "jd": {
       "title": "Job Description",
       "uploadFile": "Tải lên file (PDF/DOCX/TXT)",
       "urlPlaceholder": "Hoặc dán URL job công khai",
       "scrape": "Lấy JD từ URL",
       "textPlaceholder": "Hoặc paste JD ở đây..."
     },
     "errors": {
       "unauthorized": "Đăng nhập để dùng shared key, hoặc nhập key của bạn",
       "quotaExceeded": "Hết quota hôm nay. Quota sẽ reset lúc 00:00.",
       "scrapeFailed": "Không lấy được JD từ URL này. Paste tay nhé.",
       "parseFailed": "Không parse được file. Thử TXT hoặc paste tay.",
       "llmError": "LLM provider lỗi: {message}"
     }
   }
   ```

4. **`messages/en.json`** — mirror keys
   ```json
   {
     "app": { "title": "CV-EX Refactor", "tagline": "LLM-powered CV ↔ JD matching with knowledge gap suggestions" },
     "settings": { "useSharedKey": "Use shared key (login required)", "useByok": "Use my own key", "provider": "Provider", "model": "Model", "apiKey": "API Key", "save": "Save settings" },
     "jd": { "title": "Job Description", "uploadFile": "Upload file (PDF/DOCX/TXT)", "urlPlaceholder": "Or paste public job URL", "scrape": "Fetch JD from URL", "textPlaceholder": "Or paste JD here..." },
     "errors": { "unauthorized": "Login to use shared key, or enter your own key", "quotaExceeded": "Daily quota exceeded. Resets at 00:00 VN time.", "scrapeFailed": "Could not fetch JD. Paste manually.", "parseFailed": "Parse failed. Try TXT or paste manually.", "llmError": "LLM provider error: {message}" }
   }
   ```

5. **`src/components/layout/locale-toggle.tsx`**
   ```tsx
   'use client';
   import { useRouter } from 'next/navigation';

   export function LocaleToggle({ current }: { current: 'vi' | 'en' }) {
     const router = useRouter();
     const next = current === 'vi' ? 'en' : 'vi';
     const toggle = () => {
       document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
       router.refresh();
     };
     return (
       <button onClick={toggle} className="text-xs font-bold text-muted hover:text-primary">
         {current === 'vi' ? 'EN' : 'VI'}
       </button>
     );
   }
   ```

6. **Update `src/app/layout.tsx`**
   ```tsx
   import { NextIntlClientProvider } from 'next-intl';
   import { getLocale, getMessages } from 'next-intl/server';

   export default async function RootLayout({ children }: { children: React.ReactNode }) {
     const locale = await getLocale();
     const messages = await getMessages();
     return (
       <html lang={locale}>
         <body>
           <NextIntlClientProvider messages={messages}>
             {children}
           </NextIntlClientProvider>
         </body>
       </html>
     );
   }
   ```

7. **Wrap strings** trong mọi component:
   - Server component: `const t = await getTranslations('jd'); ... {t('title')}`
   - Client component: `const t = useTranslations('jd'); ... {t('title')}`

### Part B — Security audit (~1h)

**Checklist:**

- [ ] Grep `grep -rn "GEMINI_API_KEY\|OPENAI_API_KEY" src/` — chỉ xuất hiện trong `src/lib/env.ts` và API route handlers
- [ ] Build production: `pnpm build` → grep `.next/static` cho `GEMINI_API_KEY` / `OPENAI_API_KEY` literals → MUST empty
- [ ] Verify response schemas không có field `apiKey`
- [ ] Test response Network tab: BYOK request body chứa apiKey (expected), response không chứa
- [ ] Test response Network tab: shared request không có apiKey trong body, không có trong response
- [ ] Run `npx gitleaks detect --source . --no-git --redact` → no findings
- [ ] `.env.local` không committed (`git check-ignore .env.local` should succeed)
- [ ] Verify SSRF guard: `curl POST /api/scrape -d '{"url":"http://10.0.0.1"}'` → 400
- [ ] Verify rate limit: bash loop 40 req → 30+ trả 429
- [ ] Verify file size limit: upload file 10MB → 413
- [ ] CSP headers (optional Phase 1): add basic CSP qua `next.config.ts`:
  ```ts
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  }
  ```
- [ ] Auth.js cookie `Secure` + `HttpOnly` in production (verify DevTools)
- [ ] Production env vars set ON VERCEL (không trong code)

### Part C — Deploy (~1.5h)

1. **Vercel project config**
   - Production environment: set tất cả env vars từ `.env.example`
   - `GEMINI_API_KEY` + `OPENAI_API_KEY` set Production scope only (không Preview để tránh leak qua PR)
   - `NEXTAUTH_URL` = production URL (vd `https://cv-ex-refactor.vercel.app`)

2. **Google OAuth update**
   - Cloud Console → Credentials → OAuth 2.0 Client
   - Add production redirect URI: `https://<production-domain>/api/auth/callback/google`

3. **Vercel KV link production**
   - Đã link Phase 07 → verify production scope cũng có

4. **First deploy**
   ```bash
   git push origin main          # nếu setup git integration
   # hoặc
   pnpm dlx vercel --prod
   ```

5. **Smoke test production**
   - Visit homepage → render OK
   - Sign in Google → callback success
   - BYOK Gemini → analyze 1 sample CV+JD → result chính xác
   - Shared Gemini (sau khi login) → analyze → result + quota counter giảm
   - Try 6th analyze → 429
   - Scrape 1 URL TopCV → 200 + text
   - Upload PDF → text extract
   - Toggle EN → strings switch
   - Open Network tab: verify không có shared key trong any response

6. **README final**
   - Setup local dev
   - Env vars list (link `.env.example`)
   - Deploy to Vercel
   - Quota config
   - Architecture diagram (link brainstorm report)

## Todo List

### i18n
- [ ] Install `next-intl`, config plugin
- [ ] Tạo `i18n/request.ts` với cookie locale detection
- [ ] Tạo `messages/vi.json` đầy đủ keys
- [ ] Tạo `messages/en.json` mirror
- [ ] Tạo `locale-toggle.tsx` component
- [ ] Update `layout.tsx` với `NextIntlClientProvider`
- [ ] Wrap mọi UI string trong components Phase 03 với `t()`
- [ ] Wrap error messages từ API routes (có thể tạo `error-i18n.ts` helper)
- [ ] Manual test: toggle VI ↔ EN, refresh, locale persist

### Security audit
- [ ] Grep `GEMINI_API_KEY` / `OPENAI_API_KEY` trong src + build output
- [ ] Run gitleaks scan
- [ ] Verify CSP/security headers
- [ ] Verify SSRF guard with curl
- [ ] Verify rate limit with loop
- [ ] Verify file size limit
- [ ] Verify auth cookie attrs

### Deploy
- [ ] Set Vercel env vars (Production scope)
- [ ] Add Google OAuth prod callback URL
- [ ] Verify Vercel KV linked production
- [ ] Deploy `pnpm dlx vercel --prod`
- [ ] Smoke test 8 scenarios trong "First deploy" step 5
- [ ] Update README với deploy guide
- [ ] Tag git release `v0.1.0`

## Success Criteria

### i18n
- ✅ Default VN render khi vào lần đầu
- ✅ Toggle EN → tất cả strings switch
- ✅ Refresh giữ locale (cookie persist)
- ✅ Không string nào hard-code trong component (audit grep)

### Security
- ✅ Zero shared key leak (grep clean, build output clean, response payload clean)
- ✅ gitleaks no findings
- ✅ SSRF/rate-limit/file-size guards working
- ✅ Production cookie Secure + HttpOnly

### Deploy
- ✅ Production URL accessible
- ✅ OAuth login flow OK production
- ✅ BYOK + shared key flows both work production
- ✅ Quota counter reflect production KV
- ✅ Lighthouse mobile score > 80 (rough proxy cho không có blocker tệ)
- ✅ Smoke test 8 scenarios pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| i18n key drift (en thiếu key) | Med | Low | Lint check trong CI Phase 2, manual Phase 1 |
| OAuth callback URL sai | High | High | Document rõ trong deploy guide, test ngay sau deploy |
| Vercel function size > 50MB | Low | High | Verify Phase 04 đã pass, monitor `vercel build` output |
| Prod env vars miss | Med | High | `.env.example` đầy đủ, deploy checklist trong README |
| KV không có data trong prod (fresh deploy) | Low | Low | Expected, normal start |
| Domain certificate (nếu custom) | Med | Low | Vercel default `*.vercel.app` đủ Phase 1, custom Phase 2 |

## Security Considerations

- **Final audit must pass trước khi merge main**
- **Shared key Production scope only** — Preview deploys không có shared key (force BYOK testing)
- **Logs production** — verify Vercel logs không chứa keys (check 1 tuần đầu)
- **Disable shared key emergency switch** — `DISABLE_SHARED_KEY` env var

## Operational Concerns

- **Monitoring Phase 1**: chỉ Vercel built-in logs + KV dashboard. Phase 2 thêm Sentry/Axiom nếu cần
- **Cost alert**: setup Google Cloud billing alert + OpenAI usage alert
- **Backup plan**: nếu shared key bị abuse → `DISABLE_SHARED_KEY=1` + redeploy → user vẫn dùng BYOK

## Open Questions

- ⏳ Custom domain Phase 1 hay defer? — **Decision:** Defer. `*.vercel.app` đủ Phase 1.
- ⏳ Analytics (Vercel Analytics)? — **Decision:** Phase 2. Phase 1 chỉ care về privacy.

## Next Steps (Phase 2 ideas)

- Persistent analysis history (cần DB)
- Multi-CV compare side-by-side
- Custom prompts/templates
- Resume builder từ scratch
- LinkedIn import via OAuth
- Webhook/email khi quota reset
- Analytics dashboard cho user

---

## Phase 1 Completion Checklist

- [ ] Tất cả 8 phases marked completed
- [ ] Smoke test production 8 scenarios pass
- [ ] Security audit pass
- [ ] README done
- [ ] Git tag `v0.1.0` pushed
- [ ] Brainstorm/plan archived hoặc moved to `completed/`
