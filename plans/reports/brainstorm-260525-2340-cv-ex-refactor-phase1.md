# Brainstorm Report — CV-EX Refactor (Phase 1)

**Date:** 2026-05-25 23:40 (Asia/Bangkok)
**Status:** Design approved, ready for /ck:plan
**Source HTML:** `cv_fit_scoring_app.html` (1037 LOC, single-page, client-only)

---

## 1. Problem Statement

HTML hiện tại có giá trị cốt lõi tốt (LLM scoring + matched CV rewrite) nhưng vướng 3 hạn chế phá vỡ requirement mới:

1. **Client-only** → không thể giữ shared API key bí mật. Bất cứ ai mở DevTools đều thấy key.
2. **CORS** → không scrape được JD từ public URL trực tiếp trong browser.
3. **PDF parsing** → chưa hỗ trợ. Người dùng phải copy-paste tay từ PDF.

**Mục tiêu Phase 1:**
- Web app full-stack giữ nguyên UX và logic phân tích hiện có
- 2 access mode rõ ràng: **shared-key (login required + quota)** hoặc **BYOK (guest, unlimited)**
- Ingest JD từ: paste text / public URL / upload PDF/DOCX/TXT
- **Hard requirement:** shared API key không bao giờ rời server

---

## 2. Approaches Evaluated

| Approach | Verdict | Lý do |
|----------|---------|------|
| A. Next.js full-stack (Vercel) | ✅ **Chosen** | 1 codebase, API routes ẩn key, Edge streaming cover LLM timeout, deploy 1-click, free tier ổn |
| B. Static SPA + Cloudflare Workers | ❌ | 2 deploy targets, edge free tier rộng hơn nhưng overhead config CORS không cần thiết Phase 1 |
| C. Giữ HTML + thêm Node backend | ❌ | Vẫn phải rewrite UI để có routing/state mgmt khi Phase 2 mở rộng. Refactor 2 lần |

---

## 3. Recommended Solution — Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    CV-EX Refactor (Next.js 15)                 │
│                       Vercel Hobby tier                        │
├────────────────────────────────────────────────────────────────┤
│  CLIENT (React 19, Zustand, next-intl vi/en)                   │
│    ├─ Main UI (port từ HTML, giữ visual identity)              │
│    └─ Settings panel: BYOK input + "Use shared key" toggle     │
├────────────────────────────────────────────────────────────────┤
│  SERVER — Edge runtime (streaming)                             │
│    ├─ POST /api/analyze        → LLM scoring JSON              │
│    └─ POST /api/generate-cv    → LLM matched CV markdown       │
│                                                                │
│  SERVER — Node runtime (10s timeout)                           │
│    ├─ POST /api/scrape         → URL → JD text                 │
│    ├─ POST /api/parse          → file → text                   │
│    ├─ GET  /api/quota          → remaining quota               │
│    └─ /api/auth/[...nextauth]  → Auth.js v5 + Google           │
├────────────────────────────────────────────────────────────────┤
│  INFRA                                                         │
│    ├─ Vercel KV (Upstash Redis) → quota counters only          │
│    └─ Server env: GEMINI_API_KEY, OPENAI_API_KEY, NEXTAUTH_*   │
└────────────────────────────────────────────────────────────────┘
```

### Access Mode Flow

```
Request → /api/analyze with body.llm
   │
   ├─ body.llm.apiKey present?
   │   │
   │   ├─ YES (BYOK) → call provider with user's key
   │   │              → no auth, no quota, no logging key
   │   │
   │   └─ NO (shared) → check session (NextAuth)
   │                  │
   │                  ├─ No session → 401 { code: "unauthorized" }
   │                  │
   │                  └─ Session → KV.get(quota:userId:YYYY-MM-DD) < 5?
   │                              │
   │                              ├─ No → 429 { code: "quota_exceeded" }
   │                              │
   │                              └─ Yes → KV.incr, use process.env.GEMINI_API_KEY
   │                                     → return result + quotaRemaining
```

---

## 4. Tech Stack Decisions

| Layer | Choice | Rationale |
|-------|--------|----------|
| Framework | Next.js 15 App Router + TS | RSC + API routes + Vercel native |
| Auth | Auth.js v5 + Google provider | OAuth chuẩn, JWT session, ít state |
| State | Zustand | Đủ cho Phase 1, không cần Redux |
| Styling | Tailwind + port design tokens | Giữ identity HTML cũ, tốc độ port nhanh |
| i18n | next-intl | Tích hợp App Router tốt nhất |
| Validation | Zod | Type-safe request schemas |
| KV | Vercel KV (Upstash Redis) | Native integration, free tier đủ |
| Scrape | @mozilla/readability + jsdom | Best-effort cho job board public |
| PDF | unpdf | Vercel-safe, no native deps (tránh pdf-parse vendor issues) |
| DOCX | mammoth | Đã được dùng trong HTML cũ, ổn định |
| LLM | Native fetch (Gemini, OpenAI, custom) | Mirror logic HTML cũ, không cần SDK |

---

## 5. Security Model

### Key invariants
- `process.env.GEMINI_API_KEY` / `OPENAI_API_KEY` chỉ tồn tại trên server. Không bao giờ trong response, không log, không bundle vào client.
- BYOK key đi qua HTTPS body, không persist đâu cả, log middleware redact field `apiKey`.
- Quota check dựa trên `session.user.id` từ JWT, không phải cookie ID (chống bypass).

### Threat model

| Threat | Mitigation |
|--------|-----------|
| Shared key leak via response | Response schema không bao giờ chứa apiKey. Type-check enforce. |
| Shared key leak via logs | Pino/console middleware redact `apiKey`, `Authorization` headers. |
| SSRF via /api/scrape | Pre-resolve DNS, block 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1 |
| Quota bypass | Counter theo `user.id`, không cookie. Login lại = same user.id. |
| Cost abuse via BYOK endpoint | Light IP rate-limit 60 req/min trên /api/scrape, /api/parse |
| Malicious file upload | Magic-byte validation, size cap 4.5MB, text cap 50K chars |
| PII trong CV/JD | In-memory only. Privacy notice rõ ràng. No analytics on content. |

---

## 6. Operational Concerns

### Vercel Hobby constraints
- Edge function: 25s total (cover LLM streaming OK)
- Node function: 10s (scrape + parse OK)
- KV free: 30K commands/day (quota check = 2 ops/request → 15K analyses/day, đủ)
- Bandwidth: 100GB/month (đủ cho dev + small-scale launch)

### Monitoring (Phase 1 — minimal)
- Vercel Logs cho errors + slow requests
- KV daily counter aggregate manually check cost
- LLM provider dashboard cho actual token usage
- Alert: setup billing alert tại Google Cloud / OpenAI nếu shared key
- **No analytics tracking content** (privacy)

### Failure modes
- LLM timeout > 25s → stream cut off, partial JSON, client phải retry
- Scrape fail (anti-bot) → return rõ error code, prompt user paste tay
- PDF parse fail (encrypted/scanned) → return error, suggest TXT/DOCX
- KV down → fallback: allow request but log warning (graceful degrade)

---

## 7. Phase 1 Scope (Cứng)

### IN
- ✅ UI port từ HTML → React components (giữ visual identity)
- ✅ JD ingest: paste / URL scrape / upload TXT/DOCX/PDF
- ✅ CV ingest: paste / upload TXT/DOCX/PDF
- ✅ LLM analyze (Gemini / OpenAI / OpenAI-compatible custom)
- ✅ Matched CV generation (on-demand, separate LLM call)
- ✅ Google OAuth + 5/2 daily quota cho shared key
- ✅ BYOK path không cần auth
- ✅ VN default + EN toggle (next-intl)
- ✅ Download report .md / .html / matched CV
- ✅ SSRF protection, rate limit, input validation

### OUT (Phase 2+)
- ❌ Persistent history (cần DB)
- ❌ Multi-CV comparison
- ❌ Resume builder/templates
- ❌ Team/sharing
- ❌ Analytics dashboard
- ❌ Mobile native app
- ❌ JS-render scraping (Puppeteer cho LinkedIn/Indeed)

---

## 8. Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Vercel Edge runtime không tương thích jsdom/unpdf | High | Split: LLM = Edge, scrape/parse = Node. Đã thiết kế |
| LLM completion > 25s bị cắt | Medium | Stream sang client, prompt LLM ngắn gọn, có thể truncate input |
| Anti-bot trên job board lớn | Medium | Accept best-effort, message "Site không support, paste tay" |
| Cost abuse khi shared key viral | High | Quota chặt + manual review weekly + có thể disable shared mode emergency |
| Auth.js v5 still in RC | Medium | Pin version, có rollback path sang v4 |
| Vercel KV cost spike | Low | Free tier đủ, alert nếu vượt |

---

## 9. Success Metrics

- ✅ Zero shared API key leak qua mọi response/log (manual audit + grep)
- ✅ Phân tích 1 CV + 1 JD < 30s end-to-end
- ✅ Scrape 5 job board phổ biến VN (TopCV, VietnamWorks, ITviec, careerbuilder.vn, 1 site công ty self-host) thành công ≥ 80%
- ✅ PDF/DOCX upload parse thành công ≥ 90% với file < 4MB
- ✅ BYOK guest có thể dùng end-to-end không cần đăng nhập
- ✅ Shared-key user thấy quota counter chính xác, reset 00:00 UTC+7

---

## 10. Next Steps

1. **Approve design** ← bạn đang ở đây
2. **Invoke `/ck:plan`** với context report này → tạo plan dir + phases:
   - Phase 01: Setup Next.js + Vercel + Auth.js
   - Phase 02: Port UI từ HTML sang React components
   - Phase 03: Implement /api/scrape + /api/parse
   - Phase 04: Implement /api/analyze + /api/generate-cv với BYOK/shared split
   - Phase 05: Quota system + Vercel KV
   - Phase 06: i18n vi/en
   - Phase 07: Security hardening + testing
   - Phase 08: Deploy + smoke test
3. **Implement** từng phase với progress tracking

---

## 11. Open Questions (resolved or accepted)

- ✅ Stack: Next.js + Vercel Hobby
- ✅ Auth: Google OAuth, BYOK guest skip
- ✅ Scrape: best-effort readability
- ✅ History: không lưu nội dung
- ✅ Quota: 5 analyses + 2 rewrites / day / user
- ✅ PDF: server-side với unpdf
- ✅ i18n: vi default + en
- ✅ Branding: CV-EX Refactor
- ⏳ Domain: chưa quyết — dùng tạm `*.vercel.app` đến khi launch
- ⏳ Google OAuth client setup: cần tự tạo trên Google Cloud Console (cấu hình ở Phase 1, step 1)
- ⏳ Vercel KV provisioning: 1-click từ Vercel dashboard, lấy env vars
