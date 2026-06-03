---
type: brainstorm
date: 2026-05-28
time: 18:54
slug: job-match-self-quiz
status: design-approved-pending-plan
project: ResumeRefine / CVMatching v0.3
related:
  - plans/260528-1030-career-path-feature/plan.md
  - docs/project-changelog.md
---

# Brainstorm — v0.3 Job-Match & Self-Quiz

## Problem

Sau khi user analyze CV + JD (v0.1) hoặc generate refined CV (v0.2), không có path tự nhiên để user áp dụng kết quả. Cần feature mới:

1. Sau bước generate CV, pull 5-10 job VN thật (match >80) từ nguồn tin cậy
2. Mỗi job liệt kê các Q&A topic (basic → advanced)
3. User click topic → LLM gen 10 câu hỏi → user tự test kiến thức (interview prep)

Mục tiêu: tăng engagement post-CV, biến output thành actionable learning loop.

## Constraints chốt qua Q&A

| Vấn đề | Quyết định | Vì sao |
|---|---|---|
| Job source | Seed 100-200 job VN curated + refresh mechanism (v0.3a). Cron-scrape live → v0.3b nếu engagement tốt | LinkedIn block scraping. ITviec/TopCV/VNW không API. Validate UX trước khi đầu tư scraper |
| Job market | VN-focused (thuê người VN / làm tại VN). ITviec + TopCV + VietnamWorks chính | User constraint |
| Scoring | Embedding prefilter → top 15 → LLM 9-dim batch → filter >80 → top 5-10 | Cost/quality optimal. 1 embed + 1 LLM call/CV |
| Topics | Fixed taxonomy ~50 topic local-first. Dislike feedback → on-demand LLM custom extract | 0 cost mặc định, refine theo signal thật |
| Quiz format | 7 MC + 3 open-ended. MC auto-grade client | Cost vừa, UX vui. User flag distractor LLM dở → cần 2-stage prompt |
| Persistence | sessionStorage only | Khớp privacy pattern hiện tại, không cần auth |
| Storage | KV-only (Upstash hiện có), abstract JobRepo | <500 jobs đủ. Cấu trúc cho phép swap Postgres sau |

## Approaches evaluated (reject reasons)

| Approach | Reject lý do |
|---|---|
| Aggregator API (JSearch/Adzuna) | VN coverage yếu, không khớp constraint "thuê người VN" |
| LinkedIn direct scrape | Anti-bot mạnh, ToS rõ ràng cấm, IP block trong giờ |
| Cron scrape live ngay v0.3 | Scope 3-4 tuần. Build trước khi validate engagement = lãng phí nếu user không click |
| Reuse /api/analyze cho mỗi job | 10K+ tokens × 50 jobs/recommend = không khả thi |
| Heuristic-only scoring | Mất nuance, missrank job match >80 |
| LLM extract topics ngay khi fetch (eager) | 10× cost vs lazy + cache, không scale |
| Neon Postgres + pgvector | YAGNI cho <500 jobs. Thêm 1 service không cần |
| Auth + persistent progress | Out of scope. Push v0.4+ |
| LLM-grade open answers | Out of scope. User chọn fire-and-forget |

## Final architecture

```
INGEST (one-shot script + manual reseed)
  scripts/ingest-jobs.ts
   → normalize → embed → tag topics → KV
  data/seed-jobs.json (initial 100-200 curated)

REFRESH (Vercel Cron 1×/day)
  /api/jobs/refresh
   → HEAD/GET source URL each active job
   → 404/410/expired pattern → move to expired
   → auto-expire verifiedAt > 21 days

RECOMMEND (/api/jobs/recommend)
  In: { cvText }
  1. hash(cv) → check cache 6h
  2. embed CV (Gemini embedding-001)
  3. cosine sim vs active embeddings (in-memory)
  4. top 20 → LLM 9-dim batch mini-score (gemini-1.5-flash, ~6K out)
  5. filter >80, top 5-10
  Quota: 3/day anon, 8/day user

QUIZ GEN (/api/quiz/generate)
  In: { topicId, jobTitle, seniority, jobId }
  cache key: hash(topicId + tier + jobTitle.norm)
  TTL 30d. miss → LLM 2-stage:
    a) gen 10 Qs (7 MC + 3 open) w/ topic+seniority context
    b) per MC: distractor prompt with rules
       - based on common misconceptions
       - same length/format as correct
       - tagged "misconception: X" for QA
  validate: dedupe + filter overlap >70%
  Quota: 5/day anon, 15/day user (debit on miss only)

FEEDBACK (/api/topics/feedback)
  POST { jobId, topicId, reason? }
   → KV list topic-feedback:<topicId>
   → weekly counter dislikes:<topicId>:<weekYMD>
  Option: "Tạo topics riêng cho JD này" → /api/topics/custom-extract
    (LLM extracts 5-8 topics specific to this JD, cached per jobId, debit 1)
```

## Topic taxonomy

`src/lib/topics/taxonomy.ts` — ~50 topic curated lần đầu:

```ts
type Topic = {
  id: string;            // 'react-hooks'
  name: string;          // 'React Hooks'
  category: 'frontend' | 'backend' | 'db' | 'devops' | 'soft' | 'domain';
  tier: 'basic' | 'intermediate' | 'advanced';
  keywords: string[];    // ['useState', 'useEffect', 'useMemo']
};
```

Tag = keyword match against JD text (case-insensitive, word-boundary). Top 5-8 hits/job sort by tier.

## Anti-stale strategy (user concern)

| Mechanism | Detail |
|---|---|
| `verifiedAt` per job | Updated mỗi refresh khi source URL còn 200 |
| Auto-expire | `verifiedAt > 21 days` → move expired bucket |
| Source check | HEAD → fallback GET 405. Detect "Job expired" pattern / redirect-to-list |
| UI badge | "Cập nhật: 3 ngày trước"; faded nếu >14 ngày |
| Manual reseed | Khi pool < 50 active. Document trong runbook |
| Cron free tier | 1×/day refresh; đủ vì TTL 21 ngày |

## Files

**New:**
- `cv-ex-refactor/src/lib/topics/taxonomy.ts`
- `cv-ex-refactor/src/lib/jobs/repo.ts`
- `cv-ex-refactor/src/lib/jobs/score.ts`
- `cv-ex-refactor/src/lib/quiz/generate.ts`
- `cv-ex-refactor/src/app/api/jobs/recommend/route.ts`
- `cv-ex-refactor/src/app/api/jobs/refresh/route.ts`
- `cv-ex-refactor/src/app/api/quiz/generate/route.ts`
- `cv-ex-refactor/src/app/api/topics/feedback/route.ts`
- `cv-ex-refactor/src/app/api/topics/custom-extract/route.ts`
- `cv-ex-refactor/src/app/(app)/interview-prep/page.tsx`
- `cv-ex-refactor/src/components/job-card.tsx`
- `cv-ex-refactor/src/components/quiz-drawer.tsx`
- `cv-ex-refactor/scripts/ingest-jobs.ts`
- `cv-ex-refactor/data/seed-jobs.json`

**Modified:**
- `cv-ex-refactor/src/lib/quota/buckets.ts` — add `job-recommend`, `quiz-generate`, `topic-custom`
- `cv-ex-refactor/src/app/(app)/refined-cv/page.tsx` — CTA "Test với 10 job phù hợp →"
- `cv-ex-refactor/src/components/sidebar.tsx` — nav "Interview Prep"
- `cv-ex-refactor/vercel.json` — cron schedule
- `cv-ex-refactor/docs/deployment.md` — env, cron, seed runbook

## Operational concerns

- **Cost target**: <$1/day với 200 active users
  - Recommend ~6K out × 3/day × N users
  - Quiz ~3K out × ~40% cache miss rate
- **Monitoring**: KV `metrics:job-recommend:<YMD>`, `metrics:quiz:<YMD>` → `/admin/usage`
- **Failure modes**:
  - Embedding down → keyword-only prefilter (degraded, working)
  - LLM batch 5xx → shortlist by keyword overlap + banner
  - Empty pool → "Đang refresh, quay lại sau" + admin webhook alert
- **Distractor QA**: log last 50/topic vào `quiz:audit:<topicId>`, manual review weekly
- **ToS exposure**: low ở seed phase (manual one-shot). Document nguồn trong `privacy.md`. Link back to source, no full JD republish, takedown channel

## Risks

| Risk | Mitigation |
|---|---|
| User không click topic → curation thừa | Phase v0.3a chỉ seed, đo CTR 1 tuần |
| LLM distractor dở → MC vô dụng | 2-stage + overlap filter + audit log |
| Job pool stale | 21-day TTL + cron + reseed runbook |
| ToS pushback | Link source, no republish, attribute, takedown |
| KV > 500 jobs | JobRepo abstract → swap Neon nhanh |

## Success metrics (v0.3a, 2 tuần sau ship)

- Activation: % user xem refined CV → click "Find jobs" ≥ 30%
- Engagement: % user click ít nhất 1 topic ≥ 25%
- Quality: dislike rate per topic < 15%
- Retention: % user quay lại quiz lần 2 ≥ 10%
- Cost ceiling: < $1/day với 200 active users

## Out of scope (defer)

- v0.3b: live cron-scrape pipeline (ITviec/TopCV/VNW scrapers)
- v0.4: LLM grade open answers; persistent progress + auth; job alert email; custom topic CRUD

## Unresolved questions (chốt mai trước khi /ck:plan)

1. **Seed data sourcing**: user tự paste 100-200 JD vào JSON, hay 1 script playwright (local-only, one-shot, không deploy)? Trade-off: tay = chậm/chính xác; script = nhanh/risk parse lỗi
2. **Entry point UI**: CTA ở cuối `/refined-cv` (linear flow) vs tab thứ 3 ngang hàng analyze/refined-cv (parallel access)?
3. **Anon quota thresholds**: 3 recommend + 5 quiz-gen/day rộng/siết? Pilot stage có thể rộng
4. **Topic taxonomy curation**: user duyệt list 50 topic hay để AI propose rồi review?
5. **Seed scope**: chỉ IT (khớp ITviec) hay mở rộng non-IT (TopCV/VNW cover sâu hơn)?
