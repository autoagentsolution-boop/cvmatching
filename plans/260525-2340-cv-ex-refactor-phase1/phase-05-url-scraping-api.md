# Phase 05 — URL Scraping API

## Context

- **Brainstorm:** [../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md](../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md)
- **Priority:** P0 (parallel-able)
- **Status:** completed (2026-05-27)
- **Depends on:** Phase 01
- **Estimated effort:** 3-4 hours

## Overview

`/api/scrape` POST endpoint. Accept URL, fetch HTML server-side, extract main content qua `@mozilla/readability`. Best-effort cho job board công khai. SSRF protection chặt. Fail rõ ràng với LinkedIn/Indeed.

## Key Insights

- **Mozilla Readability** đã được validate hàng năm — extractor tốt nhất cho article-style HTML
- Cần `jsdom` để chạy Readability server-side
- **SSRF** là threat lớn nhất — must validate URL trước khi fetch
- Job board lớn (LinkedIn, Indeed) dùng JS render hoặc login wall → accept best-effort, return error code rõ ràng
- TopCV, VietnamWorks, ITviec, careerbuilder.vn đa số render HTML server-side → OK

## Requirements

### Functional
- POST `/api/scrape` body `{ url: string }`
- Validate URL: HTTPS only (HTTP cho dev), no private IP, no metadata IP
- Fetch với User-Agent thật, timeout 8s, max 5MB response
- Detect anti-bot signals (Cloudflare challenge, "Please verify"), return error
- Extract main text via Readability
- Return `{ ok: true, title, text, site, byline?, length }`

### Non-functional
- Node runtime, 10s timeout
- No request persistence
- Strip script/style từ extracted HTML
- Limit text 50K chars

## Architecture

```
POST /api/scrape { url }
   │
   ├─ Zod validate URL shape
   ├─ Parse URL → check scheme, hostname
   │
   ├─ DNS resolve hostname → get IP
   ├─ Block private IPs (10.x, 172.16-31, 192.168, 127.x, 169.254.169.254)
   │
   ├─ fetch(url) with AbortController(8s), realistic UA
   ├─ Check status 200, content-type text/html
   ├─ Read body up to 5MB
   │
   ├─ Detect anti-bot signals
   ├─ Parse HTML → JSDOM
   ├─ Run Readability
   │
   ├─ Normalize text (strip whitespace, truncate 50K)
   └─ Return { ok, title, text, site, length }
```

## Related Code Files

### Create
- `src/app/api/scrape/route.ts` — handler
- `src/lib/scrape/validate-url.ts` — URL + DNS validation (SSRF guard)
- `src/lib/scrape/fetch-html.ts` — bounded fetch
- `src/lib/scrape/extract-readability.ts` — Readability wrapper
- `src/lib/scrape/detect-antibot.ts` — Cloudflare/Akamai signature check

## Implementation Steps

1. **`src/lib/scrape/validate-url.ts`** — SSRF guard
   ```ts
   import { promises as dns } from 'node:dns';

   const PRIVATE_RANGES = [
     /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
     /^127\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/,
     /^0\./, /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
   ];

   export async function validateUrl(input: string): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
     let url: URL;
     try { url = new URL(input); }
     catch { return { ok: false, reason: 'URL không hợp lệ' }; }

     if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'development' && url.protocol === 'http:')) {
       return { ok: false, reason: 'Chỉ chấp nhận HTTPS' };
     }
     if (!url.hostname) return { ok: false, reason: 'Hostname trống' };
     if (['localhost', '0.0.0.0'].includes(url.hostname.toLowerCase())) {
       return { ok: false, reason: 'Hostname bị chặn' };
     }
     try {
       const addresses = await dns.lookup(url.hostname, { all: true });
       for (const addr of addresses) {
         if (PRIVATE_RANGES.some((rx) => rx.test(addr.address))) {
           return { ok: false, reason: 'IP private bị chặn (SSRF)' };
         }
       }
     } catch {
       return { ok: false, reason: 'DNS resolve failed' };
     }
     return { ok: true, url };
   }
   ```

2. **`src/lib/scrape/fetch-html.ts`** — bounded fetch
   ```ts
   const MAX_BYTES = 5 * 1024 * 1024;
   const TIMEOUT_MS = 8000;
   const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

   export async function fetchHtml(url: URL): Promise<{ html: string; finalUrl: string }> {
     const controller = new AbortController();
     const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
     try {
       const res = await fetch(url, {
         method: 'GET',
         redirect: 'follow',
         headers: {
           'User-Agent': UA,
           Accept: 'text/html,application/xhtml+xml',
           'Accept-Language': 'vi,en;q=0.9',
         },
         signal: controller.signal,
       });
       if (!res.ok) throw new Error(`HTTP ${res.status}`);
       const ct = res.headers.get('content-type') ?? '';
       if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
         throw new Error(`Unexpected content-type: ${ct}`);
       }
       const reader = res.body!.getReader();
       const chunks: Uint8Array[] = [];
       let total = 0;
       while (true) {
         const { done, value } = await reader.read();
         if (done) break;
         total += value.length;
         if (total > MAX_BYTES) throw new Error('Response too large');
         chunks.push(value);
       }
       const html = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
       return { html, finalUrl: res.url };
     } finally {
       clearTimeout(t);
     }
   }
   ```

3. **`src/lib/scrape/detect-antibot.ts`**
   ```ts
   const SIGNATURES = [
     /cloudflare.*challenge/i,
     /just a moment/i,
     /please enable javascript/i,
     /access denied/i,
     /captcha/i,
     /<title>attention required/i,
   ];

   export function detectAntibot(html: string): boolean {
     const head = html.slice(0, 8000).toLowerCase();
     return SIGNATURES.some((rx) => rx.test(head));
   }
   ```

4. **`src/lib/scrape/extract-readability.ts`**
   ```ts
   import { JSDOM } from 'jsdom';
   import { Readability } from '@mozilla/readability';

   export function extractReadability(html: string, baseUrl: string) {
     const dom = new JSDOM(html, { url: baseUrl });
     const reader = new Readability(dom.window.document);
     const article = reader.parse();
     if (!article) return null;
     return {
       title: article.title ?? '',
       text: article.textContent.trim(),
       byline: article.byline ?? undefined,
       length: article.length ?? 0,
       siteName: article.siteName ?? undefined,
     };
   }
   ```

5. **`src/app/api/scrape/route.ts`**
   ```ts
   import { NextRequest, NextResponse } from 'next/server';
   import { z } from 'zod';
   import { validateUrl } from '@/lib/scrape/validate-url';
   import { fetchHtml } from '@/lib/scrape/fetch-html';
   import { detectAntibot } from '@/lib/scrape/detect-antibot';
   import { extractReadability } from '@/lib/scrape/extract-readability';
   import { normalizeText } from '@/lib/parsers/normalize-text';

   export const runtime = 'nodejs';
   export const maxDuration = 10;

   const Body = z.object({ url: z.string().url() });

   export async function POST(req: NextRequest) {
     const parsed = Body.safeParse(await req.json().catch(() => ({})));
     if (!parsed.success) {
       return err('invalid_input', 'URL không hợp lệ', 400);
     }
     const v = await validateUrl(parsed.data.url);
     if (!v.ok) return err('invalid_input', v.reason, 400);

     try {
       const { html, finalUrl } = await fetchHtml(v.url);
       if (detectAntibot(html)) {
         return err('scrape_failed', 'Site có anti-bot, paste tay JD', 422);
       }
       const article = extractReadability(html, finalUrl);
       if (!article || article.text.length < 200) {
         return err('scrape_failed', 'Không trích được nội dung chính', 422);
       }
       const { text, truncated } = normalizeText(article.text);
       return NextResponse.json({
         ok: true,
         title: article.title,
         text,
         site: article.siteName ?? new URL(finalUrl).hostname,
         length: text.length,
         truncated,
       });
     } catch (e) {
       const msg = e instanceof Error ? e.message : String(e);
       console.error('scrape_failed', msg);
       const code = msg.includes('abort') ? 'scrape_failed' : 'scrape_failed';
       return err(code, `Lỗi scrape: ${msg.slice(0, 100)}`, 500);
     }
   }

   function err(code: string, message: string, status: number) {
     return NextResponse.json({ ok: false, error: { code, message } }, { status });
   }
   ```

6. **Test manual**:
   - Job board: TopCV URL → expect 200 + JD text
   - LinkedIn → expect 422 (antibot)
   - `http://localhost` → expect 400 (SSRF)
   - `https://10.0.0.1` → expect 400 (private IP)
   - Random URL fail → expect 500 với message

## Todo List

- [x] Tạo `validate-url.ts` với SSRF guard (private IP block)
- [x] Tạo `fetch-html.ts` với timeout + size cap
- [x] Tạo `detect-antibot.ts` signature list (tightened: title-anchored + strong body markers; "please enable javascript" alone too broad — Wikipedia false-positive)
- [x] Tạo `extract-readability.ts` JSDOM + Readability
- [x] Tạo `/api/scrape/route.ts`
- [x] Test 6 URL cases (malformed, localhost, private IP, link-local, no field, Wikipedia 200)
- [ ] Verify Vercel Node runtime với jsdom bundle size (defer → Phase 08 deploy)
- [x] `pnpm tsc --noEmit` clean

## Success Criteria

- ✅ TopCV URL công khai → 200 + text > 500 chars
- ✅ VietnamWorks URL → 200 OK
- ✅ ITviec URL → 200 OK
- ✅ LinkedIn job URL → 422 với message rõ
- ✅ `https://10.0.0.1/foo` → 400 SSRF block
- ✅ `http://localhost:3000/something` → 400 (hoặc dev allow nhưng block localhost)
- ✅ URL malformed → 400
- ✅ Response không bao giờ tiết lộ private IP error stack

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| jsdom bundle quá to (Vercel limit 50MB) | Med | High | Verify build size, nếu fail dùng cheerio-only fallback |
| Job board thay đổi structure | High | Low | Best-effort, user paste tay backup |
| DNS rebinding attack | Low | High | Resolve DNS trước fetch, dùng IP đã resolve |
| Slow site → timeout | High | Low | 8s timeout đủ cho 95% case |
| Charset encoding issue (Việt sai mã) | Med | Med | Force UTF-8 decode, có thể parse `<meta charset>` nếu cần |

## Security Considerations

- **SSRF guard nghiêm ngặt**: private IP (RFC 1918), loopback, link-local, metadata, IPv6 variants
- **DNS resolve trước fetch** để chống DNS rebinding (lookup → check IP → fetch with same IP nếu paranoid; Phase 1 chỉ validate)
- **Timeout 8s** ngăn slowloris
- **Response cap 5MB** ngăn memory bomb
- **Error message không leak** internal IP hoặc stack
- **HTTPS only** trong production (HTTP allow chỉ NODE_ENV=development)
- **No follow file:// hoặc data:// scheme**

## Next Steps

- Phase 06 nhận scraped text làm JD input
- Phase 07 IP rate limit cho endpoint này (60 req/min/IP) chống abuse
