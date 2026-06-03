# Cost Projection — Pilot Re-open + Full-Flow ULTRA Worst Case

**Date:** 2026-06-03 12:50 ICT
**Trigger:** Memory `project_cvmatching_v01_state` says v0.3.1 lockdown ships rồi; today's task = re-enable runbook sau ultra-key analysis. Question: nếu bật public, 200/hr peak hôm qua scale ra daily + monthly bao nhiêu nếu MỌI user đi full-flow trên ULTRA?

---

## TL;DR

**⚠️ Updated 2026-06-03 13:02 after code-verifying Q1 + Q5:**

- **"200/hr" = pageviews**, not unique users. Adjusted **~40 unique users/hr**.
- **Cost guard hardcoded $3/bucket/day kill** → app self-caps at **$12/day max**. Worst-case $7.5K/month scenario **không thể xảy ra** dưới guard hiện tại.
- **Unmetered drain risk:** `extract-must-haves` + `career-path-suggest` pass-through quota.

**Realistic (40 unique users/hr × 10h active = 400/day, 10% full-flow conv = 40 users, ULTRA):**
- 40 × $0.125 = **$5/day = $150/month**

**Realistic FLASH default:**
- 40 × $0.031 = **$1.24/day = $37/month**

**Practical ceiling (post-hardening 2026-06-03):**
- **$18/day = $540/month** — 6 buckets × $3 kill, all-or-nothing. Pre-hardening cap was fictitious (only 1 bucket actually recorded cost).

**Pro vs Flash:** ULTRA ~4× cost per equivalent flow.

---

## 1. Inputs

| Item | Value | Source |
|------|-------|--------|
| Peak hour visits | 200 | User-reported 2026-06-02 |
| "ULTRA" model | `gemini-2.5-pro` ($1.25 in / $10 out per 1M tok) | `src/lib/llm/model-prices.ts` |
| "Default" model | `gemini-2.0-flash` (client default) → `gemini-2.5-flash` (recommend default) | `settings-store.ts`, `route.ts` |
| FLASH price (2.5) | $0.30 in / $2.50 out per 1M | `model-prices.ts` |
| Embedding | `gemini-embedding-001` ~$0.15/1M tok | Gemini pricing |

**Peak-to-daily ratio assumptions** (industry norm cho consumer apps non-24h):

| Pattern | Peak % of day | Daily visits = 200 ÷ % |
|---------|---------------|------------------------|
| Very spiky (single peak) | 20% | 1,000 |
| Moderate (1-2 peaks) | 15% | 1,333 |
| **Standard (typical)** | **10%** | **2,000** |
| Flat (24h spread) | 5% | 4,000 |

Mặc định trong report: **10% → 2,000 visits/day** (most likely cho 1 web app VN người dùng giờ ban ngày).

---

## 2. Full-flow definition

Mỗi user "đi full flow" = chạy hết 5 LLM endpoint + 1 embedding call:

| # | Endpoint | Mục đích |
|---|----------|----------|
| 1 | `/api/analyze` | Score CV vs JD trên 9 dim + insights |
| 2 | `/api/extract-must-haves` | Extract must-have requirements từ JD |
| 3 | `/api/generate-cv` | Refine CV theo JD |
| 4 | `/api/jobs/recommend` | Rank top 3-5 jobs + study topics (cộng 1 embedding call CV) |
| 5 | `/api/career-path/suggest` | Roadmap nghề nghiệp |

Realistic conv: chỉ 5-15% user complete full flow. Phần lớn bounce sau bước 1 (analyze) hoặc 2 (refine CV).

---

## 3. Token estimates per call

System prompt sizes đo từ `prompt-*.ts` (÷4 chars/token). User input: CV ~1200-1400 tok, JD ~600-750 tok. Output ước theo schema:

| Endpoint | Input tok | Output tok | FLASH $/call | PRO $/call |
|----------|-----------|------------|--------------|------------|
| analyze | ~3,400 | ~2,000 | $0.0060 | $0.0243 |
| extract-must-haves | ~1,170 | ~400 | $0.0014 | $0.0055 |
| generate-cv | ~2,670 | ~3,000 | $0.0083 | $0.0333 |
| jobs/recommend | ~5,880 | ~2,500 | $0.0080 | $0.0324 |
| career-path/suggest | ~3,300 | ~2,500 | $0.0072 | $0.0291 |
| embedding (CV) | ~1,500 | 0 | $0.00023 | $0.00023 |
| **Full-flow total** | | | **$0.031** | **$0.125** |

**ULTRA = ~4× FLASH** (output-token-heavy → output rate gap dominates).

---

## 4. Daily/monthly projections

### Scenario A — Worst case: 100% visits go full flow + ULTRA

| Daily visits | Users × $0.125 | Daily cost | Monthly (×30) |
|--------------|----------------|------------|---------------|
| 1,000 (20% peak) | $125 | $125 | **$3,750** |
| 1,333 (15% peak) | $167 | $167 | **$5,010** |
| 2,000 (10% peak) ★ | $250 | $250 | **$7,500** |
| 4,000 (5% peak) | $500 | $500 | **$15,000** |

★ = baseline assumption.

### Scenario B — Realistic: 10% full-flow conv + ULTRA

| Daily visits | Full-flow users | Daily cost | Monthly |
|--------------|-----------------|------------|---------|
| 2,000 | 200 | $25 | **$750** |
| 4,000 | 400 | $50 | **$1,500** |

### Scenario C — Realistic: 10% full-flow conv + FLASH default

| Daily visits | Full-flow users | Daily cost | Monthly |
|--------------|-----------------|------------|---------|
| 2,000 | 200 | $6.20 | **$186** |
| 4,000 | 400 | $12.40 | **$372** |

### Scenario D — Mixed: 50% analyze-only + 10% full-flow + ULTRA

200 full-flow + 1000 analyze-only @ 2000 visits/day:
- 200 × $0.125 = $25
- 1000 × $0.0243 = $24.30
- **Total: $49.30/day = $1,479/month**

---

## 5. Sensitivity drivers (rank)

1. **Output tokens dominate ULTRA cost** ($10/M out vs $1.25/M in = 8×). Anything that lets model verbose → cost spike. Current prompt cap `3-5 jobs/topics` (vừa siết 2026-06-03) helps recommend.
2. **Career-path output longest** — 2500 tok roadmap = $0.029/call PRO. Easy 30% saving nếu cap output.
3. **Embedding cache hit** — repeat CV → 0 embed cost. Cache TTL hiện tại check `embed-cache.ts`.
4. **Vertical pre-filter ship 2026-06-03** — recommend pool 150 jobs → 1 vertical (~30 jobs). Input tokens cho recommend giảm ~30-40% sau khi `build-vertical-index` populate.
5. **Quota per user** — hiện tại có quota system (consume-quota), limit free-tier per user/day. Khi public, MUST review quota numbers trước reopen.

---

## 6. Safety checks trước khi flip kill-switch

- [ ] **Cost kill-switch threshold per endpoint** — verify `src/lib/cost/guard.ts` daily caps. Recommend cap ≤ $50/day để pin worst case.
- [ ] **Quota per user/day** — verify `consume-quota.ts` numbers. Cho free user: max 5 full-flows/day → 5 × $0.125 = $0.625/user/day cap.
- [ ] **Default model gate** — confirm public default = `gemini-2.0-flash` ($0.1 in / $0.4 out, cheapest), KHÔNG mở pro mặc định.
- [ ] **Pro key gate** — nếu app expose pro option trong UI cho non-admin, ADD warning + BYOK requirement.
- [ ] **Anonymous block** — đã ship 2026-06-02 (`auth_required`). Confirm vẫn enforce sau reopen.
- [ ] **Burst handling** — 200/hr peak = 3.33/min. Gemini free tier 60 req/min cho flash, 5/min cho pro. Sau khi shared-key reopen, **pro burst sẽ rate-limit ngay** — UI cần graceful message (đã có 429 handler trong recommend route).

---

## 7. Recommendations

1. **Reopen với FLASH-only mặc định.** ULTRA chỉ qua BYOK (user paste pro key) — họ trả tiền.
2. **Cap recommend output 3-5/3-5** (đã ship `335e4e7`). Apply tương tự pattern cho career-path: cap output 1500 tok thay vì 2500.
3. **Run `build-vertical-index` post-deploy** để vertical filter active → recommend input -30%.
4. **Set daily kill-switch threshold:**
   - analyze: $20/day (~3300 calls)
   - extract-must-haves: $5/day
   - generate-cv: $25/day (~3000 calls)
   - jobs/recommend: $20/day (~2500 calls)
   - career-path: $15/day (~2000 calls)
   - **Total cap: $85/day = $2,550/month** ceiling
5. **Monitor first 48h:**
   - Track `metrics:llm:{endpoint}:{ymd}` for empirical numbers
   - If real-world tokens > 1.5× estimate → re-cap immediately
6. **Defer pro public** đến khi có Stripe/Polar billing wired — không giveaway pro tier.

---

## 8. Resolved + remaining questions (updated 2026-06-03 13:02)

### Q1 — Analytics tool + visit definition ✅ Resolved (code-verified)

- Tool: **built-in** `src/lib/analytics/visit-counter.ts` (KV-based)
- Fires from middleware `proxy.ts:113` cho mọi real page navigation (matcher excludes /api, /_next, favicon, prefetch)
- KV tracks: `visits:d:{day}` (pageview count) + `visits:d:{day}:unique` (unique IP per day)
- API `/api/visits` GET returns `{ total, totalUnique, today, todayUnique }`
- **"200/hr" = PAGEVIEW count**, NOT unique user, NOT analyze submits
- Pageview-to-unique ratio (SPA navigation: Home → /analyze → /history → /career-path): ~5×
- → **Adjusted unique users/hr ≈ 40**, not 200

### Q5 — Current kill-switch ceilings ✅ Resolved (code-verified)

`src/lib/cost/guard.ts` + `src/lib/cost/buckets.ts`:

| Item | Value |
|------|-------|
| Cost buckets | 4: analyze, career-path, generate-cv, job-recommend |
| Per-bucket WARN | $1/24h |
| Per-bucket KILL | $3/24h (sets `kill-switch:{bucket}` KV flag, 24h TTL) |
| **Total ceiling** | **$12/day** (4 × $3) trước khi all-buckets trip |
| Unmetered endpoints | `extract-must-haves`, `career-path-suggest` — free drain (rate-limit IP only) |
| Quota logged-in user/day | analyze=5, generate-cv=2, career-path=3, job-recommend=12 |
| Quota anon | analyze=3, generate-cv=1, career-path=2, job-recommend=5 — but **anon blocked** by `auth_required` since 2026-06-02 |
| Alert webhook | `env.ALERT_WEBHOOK_URL` (verify set in prod) |

**⚠️ Update 2026-06-03 13:17 — Cost guard hardened (commit `ac27cab`):**

Pre-hardening state had silent gaps:
- 3/4 metered routes (analyze, career-path, generate-cv) check kill-switch nhưng **KHÔNG record cost** → cumulative ở 0 → kill-switch never trip → **theoretical $12/day cap was fictitious**
- 2 hot endpoints (extract-must-haves, career-path-suggest) **không guard gì cả**
- jobs/recommend records BYOK cost vào shared bucket → poisons cumulative

Post-hardening (6 buckets, uniform `!byok` gate):
- analyze ($0.024/call PRO): **125 calls** = ~25 users full-flow before kill
- generate-cv ($0.033/call PRO): **90 calls** = ~30 users
- job-recommend ($0.032/call PRO): **94 calls** = ~31 users
- career-path ($0.029/call PRO): **103 calls** = ~34 users
- extract-must-haves ($0.0055/call PRO): **545 calls** = covers ~25 users (auto-fires multiple times)
- career-path-suggest ($0.029/call PRO): **103 calls** = ~34 users

→ **App tự bảo vệ ($18/day max ceiling)** = 6 × $3. Worst case scenario (Section 4 $7.5K/month) **bây giờ THỰC SỰ không thể xảy ra**.

→ Admin/usage page mới có Cost kill-switch section: per-bucket spend, % of KILL, status badge + ALERT_WEBHOOK_URL unset warning.

### Q1 follow-up — Yesterday's actual numbers

Daily key `visits:d:{ymd}` TTL'd → expired at VN midnight. Yesterday's exact pageview/unique not retrievable from KV now. Có thể:
- Today numbers callable: `curl https://{prod}/api/visits` cho today snapshot
- Historic: cần backfill từ log Vercel / hoặc add daily snapshot script

### Q2 — Peak hour clarified (user 2026-06-03 13:02)

200/hr hôm qua = **đo TRƯỚC** lockdown 2026-06-02, lúc anon + shared-key vẫn open. Post-lockdown traffic profile khác hẳn vì anon bị gate `auth_required`. Số 200 → 24h scale là chỉ baseline historical, KHÔNG predict post-reopen traffic.

### Q3 + Q4 — Resolved by shipping observability (commit `a9964d1`)

**Lý do defer answer:** chưa có data structured. Solution: ship tracking trước, đọc data sau 24h.

**Shipped:**
- `proxy.ts` light JWT decode mỗi pageview → flag `isAuthed`
- `visits:d:<ymd>:authed` daily counter (90-day TTL rolling)
- Admin/usage page mới: "Visit funnel" section (Pageviews / Unique IPs / Signed-in / Action submits với % drop-off) + "Visit history" 90-day rolling
- Daily table mở rộng Fit Job + Career columns (data đã có từ `logLlmCall`, chỉ thiếu render)

**24h sau reopen → đọc admin/usage page → Q3 + Q4 tự resolve bằng data thật:**
- Q3: % auth = `visits:d:authed / visits:d:pageviews`
- Q4: conversion analyze = `usage:global:analyze:ok / visits:d:authed` (vì only authed mới submit được sau lockdown)

### Re-cost với data sẽ có

Khi data 24h sau reopen có sẵn, công thức:

```
daily_cost ≈ analyze_submits × $0.024_PRO_or_$0.006_FLASH
           + refine_cv_submits × $0.033 / $0.0098
           + fit_job_submits × $0.032 / $0.008
           + career_submits × $0.029 / $0.0072
           + must_haves_calls × $0.0055 / $0.0014
```

Cap thực tế = `min(daily_cost, $12)` vì kill-switch hardcoded $3/bucket.
