---
type: brainstorm
date: 2026-06-04
plan: 260604-1218-company-profile-reviews
author: claude (opus 4.7)
session: 6/4/2026 12:18 GMT+7
---

# Brainstorm — Company Profile + Reviews on Job Fit Detail

## Context

User request: thêm 1 phần cho job-fit để lưu data của company đăng tuyển + review của cty cho user có thể review trước khi quyết định apply.

Job Fit detail (`src/features/job-fit/job-fit-detail-page.tsx`) hiện chỉ có match scores + study topics. Job record có `company: string` thuần — zero downstream signal. Buộc user google manual mỗi job → kill funnel.

## Options Considered

### Data source matrix

| Approach | Phù hợp VN | Legal/ToS | Cold-start | Cost/company | Verdict |
|---|---|---|---|---|---|
| **A. Scrape company section từ job source** (ITviec, TopCV, VNW, VL24H) | Cao — có sẵn page company chi tiết | OK (cùng posture với scrape job hiện tại) | None | ~0, 1 fetch | **Tier 1 — luôn dùng** |
| **B. LLM grounded enrichment** (Gemini + web search) | Cao — fill gap cho SME ko web presence | Cần citations + disclaimer | None | ~$0.005, cache 30d | **Tier 2 — lazy on detail open** |
| **C. Scrape Glassdoor/Indeed full reviews** | Thấp — VN companies sparse trên Glassdoor | Risky (UGC của 3rd party) | None | Per-scrape | **Bỏ pilot — chỉ link out + score** |
| **D. Own UGC reviews** | Cao long-term | Moderation + defamation liability | **Severe** | Eng-heavy | **Post-pilot, Phase 08** |

### UX placement

- Right rail card desktop / collapsible-above-match-reasons mobile
- Progressive render: instant Tier 1 → async Tier 2 + Tier 3 → empty-state cho SME ko data
- KHÔNG block Apply CTA — supplementary signal

## Decisions Locked (Q&A with user)

### Q1 — External ratings rendering
**Decision:** Inline score + count, cache 7d, refresh on TTL expire OR admin trigger. Phase 2 → DB layer for cross-source dedup.

Rationale: user wants signal visible without click; 7d cache + admin-only refresh caps scrape load and ToS risk. DB dedup post-pilot solves "FPT trên ITviec vs FPT trên TopCV" duplicate enrichment problem.

### Q2 — LLM name-resolution dedup threshold
**Decision:** Conservative — ≥0.95 auto-merge, 0.7-0.95 admin queue, <0.7 mint new.

Rationale: false-merge cost (poison 2 companies' enrichment) > false-split cost (admin dedupes later). Admin queue absorbs grey zone without auto-damage.

### Q3 — Phase A timing
**Decision:** Parallel — write plan + phase files now; pilot reopen runbook executes independently in separate ops track.

Rationale: planning work is read-write isolated from runbook ops (different files, different concerns). No focus split since planning is one-shot.

### Q4 — Tier 1 scrape refresh policy
**Decision:** 90d TTL auto-refetch at-detail-open (check `expiresAt` on read).

Rationale: company facts (size, industry, HQ) change slowly; 90d balances freshness vs scrape load; lazy refresh avoids cron complexity until Phase 7 shows top-viewed pareto.

## Architecture Summary

### Entity

```ts
// lib/companies/types.ts
export interface Company {
  id: string;                 // slug: 'fpt-software'
  canonicalName: string;
  aliases: string[];          // ["FPT", "Cty FPT Software", "FPT JSC"]
  industry?: string;
  sizeRange?: '1-50' | '51-200' | '201-500' | '501-1000' | '1000+';
  hqLocation?: string;
  website?: string;
  logoUrl?: string;           // source CDN URL at pilot, self-host post-pilot
  description?: string;       // tier 1 scrape

  // Tier 2 — LLM enrichment, 30d TTL, lazy
  enrichment?: {
    summary: string;          // 2-3 sentences
    pros: string[];           // each backed by citations
    cons: string[];           // ≥2 citations OR hidden (defamation guard)
    citations: Array<{ title: string; url: string; date?: string }>;
    enrichedAt: string;
    expiresAt: string;
    insufficientSources?: boolean;
  };

  // Tier 1 — scrape, 90d TTL
  tier1ScrapedAt: string;
  tier1ExpiresAt: string;
  tier1Pending?: boolean;     // true if scrape failed, retry on next ingest
}

// External ratings — separate KV key to honor different TTL
export interface ExternalRatings {
  companyId: string;
  glassdoor?: { score: number; count: number; url: string };
  google?: { score: number; count: number; url: string };
  fetchedAt: string;
  expiresAt: string;          // 7d
}
```

### Job shape change

```ts
// lib/jobs/types.ts — additive only
export interface Job {
  // ... existing fields ...
  companyId?: string;         // NEW — optional, backward compat with 150 live jobs
}
```

### KV namespace (pilot)

```
co:{slug}                       → Company JSON (tier 1 + tier 2)
co-alias:{normalized-name}      → slug (resolver index)
co-ratings:{slug}               → ExternalRatings JSON (7d TTL)
co-enrich-calls:{YYYY-MM}       → counter (abuse guard)
co-dedup-queue:{slug-pair}      → DedupCandidate JSON (Phase 7)
```

Maps 1:1 to Postgres tables in Phase 08.

### Data flow

**Ingest path (Tier 1):**
1. Scrape job detail → JobPosting parse
2. Extract `company` string → normalize (lowercase, strip "Cty/Co.,Ltd/JSC/TNHH")
3. Lookup `co-alias:{normalized}`
   - **Hit** → reuse slug, attach `companyId` to Job, done
   - **Miss** → LLM dedup top-3 by name similarity
     - **≥0.95** → auto-merge, update alias index
     - **0.7-0.95** → queue, attach provisional `companyId`
     - **<0.7** → mint new slug, scrape company page, save `co:{slug}` with 90d TTL

**User detail-open path (Tier 2 + Tier 3, lazy):**
1. `GET /api/companies/[slug]`
2. Load `co:{slug}` (Tier 1, always present after ingest)
3. Parallel:
   - If `enrichment.expiresAt` past or missing → Gemini grounded search → cache 30d
   - If `co-ratings:{slug}` expired/missing → Glassdoor + Google scrape → cache 7d
4. Return merged shape to client
5. UI: render Tier 1 instant via SSR, Suspense-swap Tier 2 + Tier 3

### Failure modes

| Mode | Handling |
|---|---|
| LLM grounded search returns <2 sources for a `cons` claim | Cache `{ insufficientSources: true, cons: [] }`, 7d TTL |
| Glassdoor/Google rate-limit | Cache `{ ratings: null, retryAfter: now+7d }` |
| Company-page scrape fails at ingest | Mint stub `co:{slug}` (name only), `tier1Pending: true`, retry on next ingest |
| All 4xx/5xx on `/api/companies/[slug]` | Surface to user per [[feedback_error_surfacing_no_silent_fallback]]; only 404 silent |
| LLM enrichment cost spike | Pushover alert at 2× monthly baseline via `co-enrich-calls:{YYYY-MM}` counter |

## Security / Legal Constraints

1. **Defamation**: LLM `cons` rendering blocked unless ≥2 grounded citations per item. Disclaimer text fixed: "Tổng hợp từ nguồn công khai, không phản ánh quan điểm của [platform]". Neutral phrasing template ("Theo X, …").
2. **PII**: Enrichment may name public roles (CEO, founder). Must NOT name non-public employees.
3. **Nghị định 13/2023 (VN)**: Company data is pháp nhân, not personal data — clear.
4. **Source ToS**: Job-source company pages share posture with existing job scrape (accepted). Glassdoor link-out only — no review body scrape.
5. **Per memory [[feedback_secrets_never_generated_in_chat]]**: admin refetch endpoints behind existing admin auth + DISABLE_SHARED_KEY, no per-feature key.

## Cost Profile

| Component | Per-event cost | Cache | Monthly ceiling |
|---|---|---|---|
| Tier 1 scrape (company page) | ~0 (1 fetch) | 90d, auto on stale | < $1 (mostly ingest-time only) |
| Tier 2 LLM enrichment | ~$0.005 per call (Gemini grounded) | 30d, lazy | ~$7.50 at 1.5K unique companies, 1× refresh/mo |
| Tier 3 external ratings | ~0 (2 fetches) | 7d, lazy | < $1 |
| Total | | | **< $20/mo at current pool size** |

Lazy firing caps blast radius — cost only paid for companies users actually open.

## Cross-References

- Existing plan [[260603-1655-ingest-taxonomy]] — Phase 2 of this plan hooks into per-source scrape modules that taxonomy plan creates
- Existing plan [[260602-1739-hybrid-refresh-topup]] — independent track, no conflict
- Memory [[project_post_pilot_db_migration]] — Phase 08 of this plan is the company-domain slice of that migration
- Memory [[feedback_filter_before_scrape]] — company-page scrape only fires for companies surviving job filter
- Memory [[feedback_error_surfacing_no_silent_fallback]] — surface contract for `/api/companies/[slug]`
- Memory [[feedback_ui_ux_design_system]] — company card must use tokens + shared components

## Phasing

| # | Effort | Output |
|---|---|---|
| 01 | 2-3h | Company entity + KV namespace + alias resolver + normalize util |
| 02 | 2-3h | Per-source company-page scrapers + ingest hook + 90d TTL |
| 03 | 2-3h | External ratings scrape (Glassdoor + Google) + 7d cache + admin refetch endpoint |
| 04 | 2-3h | Company card on Job Fit detail (Tier 1 + ratings instant render) |
| 05 | 2-3h | `/api/companies/[slug]` + Gemini grounded enrichment + insufficient-source guard |
| 06 | 1-2h | Async enrichment UI + citations + disclaimer |
| 07 | 2-3h | Admin dedup queue UI + manual merge/split + refetch endpoints |
| 08 | deferred | Postgres migration + UGC reviews (post-pilot, blocked on auth maturity + ≥1K users) |

Total active phases (01-07): **14-20h**, ~2-3 work days.

## Unresolved Questions (carry to plan)

1. Phase 08 trigger condition: pilot exit OR ≥1K users OR ≥500 unique companies — whichever first?
2. Logo handling: if source CDN returns 403 to our domain → hide vs self-host? Default: hide, defer self-host to Phase 08.
3. Sister-company policy: keep separate or model parent-child? Default: separate.
4. Cron-driven Tier 1 refresh vs lazy at-detail-open. Default: lazy until Phase 7 data shows clear pareto.
