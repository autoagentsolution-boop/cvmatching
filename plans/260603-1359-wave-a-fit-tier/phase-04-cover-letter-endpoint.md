# Phase 4 — Cover Letter Endpoint + UI

**Day:** Sat 2026-06-06 | **Effort:** 4-6h | **Status:** Pending

## Goal

New `/api/generate-cover-letter` endpoint mirror generate-cv pattern. 3/day quota. New cost bucket (7 total). Wire `cover-letter-stub.tsx` to call endpoint and render markdown.

## Files

**Create:**
- `cv-ex-refactor/src/app/api/generate-cover-letter/route.ts`
- `cv-ex-refactor/src/lib/llm/prompt-generate-cover-letter.ts`
- `cv-ex-refactor/src/lib/schemas/cover-letter-request.ts`

**Modify:**
- `cv-ex-refactor/src/features/refined-cv/cover-letter-stub.tsx` → rename to `cover-letter-block.tsx`, wire to new endpoint, render markdown
- `cv-ex-refactor/src/lib/quota/consume-quota.ts` — add `'generate-cover-letter': 3` to QUOTA_LIMITS + QuotaAction union
- `cv-ex-refactor/src/lib/cost/buckets.ts` — add `'generate-cover-letter'` → 7 buckets
- `cv-ex-refactor/src/lib/usage/track-usage.ts` — add to UsageAction union
- `cv-ex-refactor/src/lib/usage/read-usage.ts` — add keys for new bucket + return new field
- `cv-ex-refactor/src/app/(app)/admin/usage/page.tsx` — column "Cover Letter" trong daily table
- `cv-ex-refactor/src/features/refined-cv/refined-cv-page.tsx` — use new block name

## Spec — cover-letter-request.ts

```ts
export const CoverLetterBody = z.object({
  cvText: z.string().min(50).max(20000),
  jdContent: z.string().min(50).max(10000),
  jobTitle: z.string().max(200),
  company: z.string().max(200),
  llm: LlmConfigSchema,
});
```

## Spec — prompt-generate-cover-letter.ts

System prompt skeleton (~80 LOC):
```
Bạn là chuyên gia viết cover letter. Viết cover letter ngắn gọn (250-400 từ) cho ứng viên này, gửi tới {company} cho vị trí {jobTitle}.

Cấu trúc bắt buộc:
1. Mở (1-2 câu): thể hiện hiểu biết về {company} + lý do quan tâm
2. Bằng chứng cụ thể (2-3 đoạn): match từ CV với requirements JD, cite kết quả định lượng
3. Đóng (1 câu): proactive next step (sẵn sàng phỏng vấn / portfolio link)

Quy tắc:
- KHÔNG fabricate. Chỉ dùng evidence từ CV gốc.
- KHÔNG generic phrases ("passionate", "team player").
- Cite ≥1 chi tiết cụ thể từ JD (tech stack, business domain, team size).
- Tone: professional + human, không stiff.
- Output: markdown với `# Cover Letter`, không có greeting "Dear Hiring Manager" (sẽ add manually).

Input:
- CV: {cvText}
- JD: {jdContent}
- Vị trí: {jobTitle}
- Công ty: {company}
```

## Spec — route.ts (mirror generate-cv structure)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { CoverLetterBody } from '@/lib/schemas/cover-letter-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { buildCoverLetterPrompts } from '@/lib/llm/prompt-generate-cover-letter';
import { callLLM } from '@/lib/llm/providers';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { checkKillSwitch, recordCost } from '@/lib/cost/guard';
import { microUsdCost } from '@/lib/llm/model-prices';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 1. Parse body via Zod
// 2. resolveApiKey(body.llm, 'generate-cover-letter', { byokToken, ip })
// 3. if (!resolved.byok && !resolved.isAdmin) checkKillSwitch('generate-cover-letter')
// 4. Build prompts, callLLM
// 5. Success: logLlmCall + recordCost (gated !byok)
// 6. Response: { markdown, quotaRemaining }
```

## Implementation steps

1. **schemas/cover-letter-request.ts** — define `CoverLetterBody` Zod schema
2. **prompt-generate-cover-letter.ts** — write builder per spec, ~100 LOC
3. **route.ts** — clone from `generate-cv/route.ts`, swap prompt builder + action name `'generate-cover-letter'`
4. **buckets.ts** — add string to `CostBucket` union + `COST_BUCKETS` array
5. **consume-quota.ts** — `QUOTA_LIMITS['generate-cover-letter'] = 3`, `ANON_QUOTA_LIMITS = 0` (anonymous blocked), extend `QuotaAction` union + `isQuotaKind`
6. **track-usage.ts** — add to `UsageAction` union
7. **read-usage.ts** — add `usage:global:{ymd}:generate-cover-letter:{ok|error}` to `readDailyRow` keys + `DailyGlobalRow` interface
8. **admin/usage/page.tsx** — daily table add column "Cover Letter ok / err"
9. **cover-letter-block.tsx** (rename from stub):
   - Read CV + JD + job context from refined-cv store
   - "Generate Cover Letter" button → POST /api/generate-cover-letter
   - Render markdown response with `<MarkdownView>`
   - Loading state + error state (per `feedback_error_surfacing_no_silent_fallback`)
   - Show remaining quota counter
10. **refined-cv-page.tsx** — replace import `CoverLetterStub` → `CoverLetterBlock`
11. **Test:**
    - Submit refined-cv flow → click "Generate Cover Letter" → markdown shows
    - Verify quota decrements (admin/usage page)
    - Verify recordCost increments (admin/usage Cost section)
    - Test 4th call same day → 429 quota exceeded message
    - Test BYOK path → unlimited, no cost record

## Acceptance

- Cover letter markdown generates with concrete CV evidence + JD reference
- Quota 3/day enforced for logged-in users
- BYOK path skips quota + cost record
- Admin bypasses kill-switch
- Daily table shows Cover Letter ok/err column
- Cost kill-switch section shows `generate-cover-letter` bucket
- No "Coming soon" placeholder remaining

## Risks

- Stub UI was placeholder — full replace may break refined-cv page layout. Mitigation: keep same outer wrapper structure
- Cover letter prompt may verbose if not tightened — cap output 600 tokens (≈400 words)
- BYOK path bug: forgot to gate recordCost → poison shared bucket. Mitigation: copy pattern from generate-cv exactly

## Next

Phase 5 — polish + smoke test + ship hardening.
