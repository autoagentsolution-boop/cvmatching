# Brainstorm Report — Wave A + Cover Letter (Fit Tier UX overhaul)

**Date:** 2026-06-03 13:59 ICT
**Status:** Approved spec, ready for `/ck:plan`
**Timeline:** ship EOW (2026-06-08 Sun)
**Total effort:** 19-29h ≈ 5 days × 6h with ~5h buffer

---

## 1. Problem statement

Job recommend hiện chỉ trả 3-5 jobs với overallScore + matchReasons + studyTopics. Thiếu:
- Gamified tier (E-S) để user quyết định nhanh nên apply hay không
- Action button per-job kèm context (Apply / Quick Fix / Improve / Roadmap)
- Red flag surface visible (data đã extract trong analyze response nhưng UI ẩn)
- Cover letter endpoint (UI stub đã có)

Wave A đóng 4 gap; Wave B (Evidence Map + Interview Talking Points) defer next week.

---

## 2. Scope decisions (locked)

| Topic | Decision | Reason |
|-------|----------|--------|
| Wave split | A + Cover Letter, defer Evidence Map + Interview Points | 5 features × 5 days = unrealistic; A core delivers decide-to-apply UX |
| Tier format | Hybrid: letter badge (E-S) + semantic tooltip + Main Reason | Letter quick scan, semantic actionable, reason user-trust |
| Tier quota | 1S + 3A + 2B + 2C + 1D + 1E = 10 jobs cap | Honest score distribution, không spam UI |
| Underfill | Show all jobs LLM trả với tier thật + note "thêm jobs ngày mai" | Honest minimal; KHÔNG fill cross-tier |
| Threshold gate | LLM scoring KHÔNG filter > 80 nữa | Cần E/D jobs để fill tier |
| Cover Letter quota | 3/day per user (logged-in) | Match generate-cv pattern, $3 kill = ~100 FLASH calls |
| Action per tier | S/A→Apply, B→Quick Fix, C→Improve, D/E→Roadmap | 4 variants kèm Cover Letter optional cho S/A |
| Action wiring | Navigate to existing pages với query params | KISS, no new state machinery |
| Red Flag UI | /analyze section + /refined-cv banner | Data đã có; surface both contexts |
| Roadmap nuance | All B/C/D/E carry skillGaps to /career-path; "đã có roadmap → regenerate?" handled inside career-path page | No new persistence needed |

---

## 3. Tier system spec

### Letter ↔ Score ↔ Semantic ↔ Action

| Tier | Score | Semantic | Primary Action | Action URL |
|------|-------|----------|----------------|------------|
| **S** | 95+ | Strong Apply 🚀 | Apply | `/refined-cv?jobId={id}&mode=apply` |
| **A** | 85-94 | Strong Apply ✅ | Apply | `/refined-cv?jobId={id}&mode=apply` |
| **B** | 75-84 | Apply After Quick Fix 🔧 | Quick Fix | `/refined-cv?jobId={id}&mode=fill-gaps` |
| **C** | 65-74 | Stretch Opportunity 🎯 | Improve | `/refined-cv?jobId={id}&mode=stretch` |
| **D** | 55-64 | Low Priority 📚 | Roadmap | `/career-path?target={title}&skillGaps={topics}` |
| **E** | <55 | Low Priority 📚 | Roadmap | `/career-path?target={title}&skillGaps={topics}` |

### Server-side compute (in `normalize-job-recommend.ts`)

```ts
function tierFromScore(score: number): TierLetter {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 55) return 'D';
  return 'E';
}

// Post-LLM: bin scored jobs into tiers, enforce quota
const QUOTA = { S: 1, A: 3, B: 2, C: 2, D: 1, E: 1 };
function enforceQuota(matches: JobMatchOut[]): JobMatchOut[] {
  const buckets = { S: [], A: [], B: [], C: [], D: [], E: [] };
  matches.forEach((m) => buckets[m.tier].push(m));
  const result: JobMatchOut[] = [];
  (['S', 'A', 'B', 'C', 'D', 'E'] as const).forEach((t) => {
    result.push(...buckets[t].slice(0, QUOTA[t]));
  });
  return result; // ≤10, can be fewer if underfilled
}
```

### Prompt update (`prompt-job-recommend.ts`)

- Drop "overallScore > 80" filter
- Change "5-10 jobs / 3-5 topics" → "score ALL candidates; return 10-15 jobs spread across score range; 3 topics/job"
- Output JSON shape adds `tier` field (LLM compute or skip and server compute)
- Token budget: ~2500 tok output (10 jobs × 250 tok each) vs current 2000 tok 3-5 jobs

---

## 4. Feature breakdown

### F1. Fit Tier badge + quota system (3-5h)

**Files:**
- NEW `cv-ex-refactor/src/lib/jobs/fit-tier.ts` — `tierFromScore()` + `QUOTA` + `enforceQuota()`
- NEW `cv-ex-refactor/src/components/ui/tier-badge.tsx` — `<TierBadge tier="S" />` + semantic tooltip
- MODIFY `cv-ex-refactor/src/lib/llm/normalize-job-recommend.ts` — drop >80 filter, call `tierFromScore` per match, apply `enforceQuota`
- MODIFY `cv-ex-refactor/src/lib/llm/prompt-job-recommend.ts` — score all + return 10-15 spread
- MODIFY `cv-ex-refactor/src/lib/jobs/types.ts` — add `tier: TierLetter` to `JobMatch`
- MODIFY `cv-ex-refactor/src/features/job-fit/job-card.tsx` + `job-fit-list-page.tsx` — render `<TierBadge>` per row

### F3. Red Flag surface UI (4-6h)

**Files:**
- NEW `cv-ex-refactor/src/features/analyze/red-flags-section.tsx` — show in `/analyze` results
- NEW `cv-ex-refactor/src/features/refined-cv/red-flags-banner.tsx` — banner at top of `/refined-cv` with expand
- MODIFY `cv-ex-refactor/src/features/analyze/{wherever-results-render}.tsx` — wire section
- MODIFY `cv-ex-refactor/src/features/refined-cv/refined-cv-page.tsx` — wire banner

Data: `redFlags: Array<{flag, concern}>` đã tồn tại trong analyze response.

### F4. Action column wiring per tier (8-12h)

**Files:**
- MODIFY `cv-ex-refactor/src/features/job-fit/job-fit-store.ts` — add `actionLoading: Set<jobId>`
- MODIFY `cv-ex-refactor/src/features/job-fit/job-card.tsx` — render action button theo tier, navigate qua `router.push()`
- MODIFY `cv-ex-refactor/src/features/job-fit/detail-actions-bar.tsx` — same logic cho detail view
- MODIFY `cv-ex-refactor/src/features/refined-cv/refined-cv-page.tsx` — đọc query params (jobId, mode) → pre-load job context, gọi generate-cv với mode
- MODIFY `cv-ex-refactor/src/app/api/generate-cv/route.ts` — accept `mode: 'apply' | 'fill-gaps' | 'stretch'` → prompt variant
- MODIFY `cv-ex-refactor/src/lib/llm/prompt-generate-cv.ts` — 3 prompt variants theo mode
- MODIFY `cv-ex-refactor/src/features/career-path/*` — đọc query params `target` + `skillGaps`, pre-fill form

### Cover Letter endpoint (4-6h)

**Files:**
- NEW `cv-ex-refactor/src/app/api/generate-cover-letter/route.ts`
- NEW `cv-ex-refactor/src/lib/llm/prompt-generate-cover-letter.ts`
- NEW `cv-ex-refactor/src/lib/schemas/cover-letter-request.ts`
- MODIFY `cv-ex-refactor/src/features/refined-cv/cover-letter-stub.tsx` → wire to new endpoint, render markdown
- MODIFY `cv-ex-refactor/src/lib/quota/consume-quota.ts` — add `'generate-cover-letter': 3` to limits + QuotaAction type
- MODIFY `cv-ex-refactor/src/lib/cost/buckets.ts` — add `'generate-cover-letter'` bucket (7 total)
- MODIFY `cv-ex-refactor/src/lib/usage/track-usage.ts` — add to UsageAction union
- MODIFY `cv-ex-refactor/src/lib/usage/read-usage.ts` — read new bucket counters cho admin/usage
- MODIFY `cv-ex-refactor/src/app/(app)/admin/usage/page.tsx` — column "Cover Letter" trong daily table

Endpoint signature mirror generate-cv: `POST { cvText, jdContent, jobTitle, company, llm }` → `{ markdown }`. checkKillSwitch + recordCost gated `!byok`.

---

## 5. Phase breakdown (5-day execution)

| Day | Focus | Output |
|-----|-------|--------|
| **Wed (today)** | F1 Tier system foundation | normalize + prompt update + types + badge component. Test với mock data. |
| **Thu** | F1 wire UI + F3 Red Flag both pages | List + detail pages show badges; red flags visible both /analyze + /refined-cv |
| **Fri** | F4 Action column wiring | All 4 action variants navigate + pre-load. Test full S/A → /refined-cv flow |
| **Sat** | Cover Letter endpoint + UI | New route + prompt + cover-letter-stub wired. Quota + cost guard. |
| **Sun** | Polish + smoke test + commit hardening | Browser E2E full flow, kill-switch sanity, admin/usage shows new bucket |

---

## 6. Risk + mitigation

| Risk | Mitigation |
|------|-----------|
| LLM output 10-15 jobs vượt MAX_TOKENS | Per-job siết: 3 study topics, 2-sentence reasons, no fluff. Test với CV 5000 char + JD 3000 char. |
| Tier quota underfill rất xấu UX (rare jobs in tier) | Honest: "Chỉ có N jobs match tiêu chí. Thêm jobs ngày mai." Banner empty-state friendly. |
| Action button race (user spam) | Disable per-row trong store, loading spinner. Navigate dùng `router.push` (1-way trip, không reentrant). |
| Cover Letter cost drain | Bucket + kill-switch + recordCost từ commit đầu (đã có pattern). $3/day = ~100 FLASH calls. |
| query params bị truncate (long skillGaps) | Encode → base64 hoặc store via session/KV nếu vượt 2KB URL. Fallback: top-3 skillGaps only. |
| Refined-CV 3 mode prompt drift | Test mỗi mode produce CV khác biệt thực sự (apply vs fix vs stretch). Smoke test mỗi mode 1 lần. |
| Career-path pre-fill từ query param: existing roadmap conflict | Inside career-path page show "Bạn đã có roadmap. Generate lại với target mới?" CTA. Native UX, không cần backend lookup. |
| Tier letter "E" gây cảm giác fail cho user | Semantic tooltip "Low Priority — vẫn worth roadmap nếu interest". Letter alone không sting. |

---

## 7. Success metrics (validate sau ship)

- Tier distribution: ≥60% recommend results có jobs ≥B tier (nếu < 60% → LLM scoring quá khắt)
- Action click-through: ≥30% recommend pageviews click button (measure via `recordVisit` action funnel)
- Cover letter usage: ≥20% S/A apply → cover letter generate
- Red flag impressions: 100% /refined-cv views show banner OR section
- Latency: recommend p95 ≤ 8s (current ~6s; +25% prompt tokens expected)
- Cost: daily shared spend bucket ≤ $0.50 average pre-reopen, ≤ $5 post-reopen

---

## 8. Out of scope (defer Wave B)

- **Evidence Map** — old CV vs new CV side-by-side with LLM annotation of "which delta addresses which JD requirement". 8-12h, UX design heavy.
- **Interview Talking Points** — new endpoint per job, 5-8 talking points (likely questions + suggested answers). 6-8h.
- **Persistent roadmap** — save user's chosen jobs into KV roadmap list, regenerate logic. Sẽ trigger khi /career-path nhìn được "Bạn đã có roadmap" thực sự.

---

## 9. Open questions (none blocking, defer to plan phase)

- Tier letter E badge color: red (alarm) vs neutral gray (low signal)?
- Cover letter language: detect từ JD outputLanguage hay user toggle?
- Action button on B tier — "Quick Fix" có nên show diff "thiếu Power BI evidence" ngay trong row hay chỉ trên refined-cv?
- LLM tier compute: trust LLM output `tier` field hay always server-recompute từ `overallScore` (safer)?
