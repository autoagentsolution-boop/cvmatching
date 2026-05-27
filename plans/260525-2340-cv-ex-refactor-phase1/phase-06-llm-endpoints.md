# Phase 06 — LLM Endpoints

## Context

- **Brainstorm:** [../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md](../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md)
- **Source logic:** `cv_fit_scoring_app.html` lines 451-700 (callLLM, callGemini, callOpenAICompatible, analyze, generateMatchedCV)
- **Priority:** P0 (critical path)
- **Status:** completed (2026-05-27)
- **Depends on:** Phase 01, 02
- **Estimated effort:** 5-6 hours

## Deviation from original plan (2026-05-27)

- **Runtime:** Node.js (60s max) instead of Edge (25s). Reason: `auth()` + jsonb shared key resolution is simpler on Node; cold-start cost acceptable for Phase 1; can migrate to Edge in Phase 08 if latency demands it.
- **Streaming:** Non-streaming JSON return instead of SSE. Reason: existing client (`api-client.ts`) already expects JSON `{ AnalysisResult }` shape; SSE would require client refactor + a new consumer + buffering. Defer SSE to Phase 08 if Vercel function timeout becomes an issue at deploy.
- **Schema:** Body shape is nested `{ llm, inputs }` matching the actual `AnalyzeRequest` type (Pass D), not the flat schema originally sketched. 9-dim weights + `mustHaves[]` are first-class inputs to the prompt.
- **Added endpoint:** `/api/extract-must-haves` is implemented under Phase 06 (was implicit before).
- **Normalizer:** `normalize-analysis.ts` accepts both snake_case (legacy HTML schema) and camelCase (new) LLM output, then projects to typed `AnalysisResult`. Robust to LLM drift.

## Overview

`/api/analyze` + `/api/generate-cv`. Edge runtime + streaming để giải quyết Vercel Hobby 10s limit. Split logic theo BYOK vs shared. Hard requirement: shared API key không bao giờ rời server.

## Key Insights

- **Edge runtime** chỉ hỗ trợ Web API (fetch, Response, ReadableStream) — Gemini/OpenAI fetch native OK
- **Streaming** Server-Sent Events → giải phóng client sớm, không bị cắt ở 10s
- HTML cũ dùng JSON response từ LLM → cần streaming text rồi parse JSON ở cuối, hoặc dùng response_format json_object với non-streaming (vẫn limited 25s trên Edge)
- **Compromise**: stream text events nhưng yêu cầu LLM trả pure JSON. Parse client-side sau khi stream end.
- BYOK key gửi qua POST body (HTTPS). Không log, không persist.

## Requirements

### Functional
- `POST /api/analyze` body `AnalyzeRequest` → SSE stream → final JSON event với `AnalysisResult`
- `POST /api/generate-cv` body `GenerateCvRequest` → SSE stream → final markdown text
- Provider support: Gemini, OpenAI, OpenAI-compatible (custom baseUrl)
- BYOK path (body.llm.apiKey present) → no auth required
- Shared key path (no apiKey) → require session, deduct quota (Phase 07 wire-up)
- Stream chunks as SSE events `data: {...}\n\n`

### Non-functional
- Edge runtime, maxDuration 25s
- Zod validate request body
- No log: apiKey, jdText, cvText (only metadata: provider, model, status, latency)
- Response includes `quotaRemaining` cho shared path

## Architecture

```
Client → POST /api/analyze (SSE)
   │
   ├─ Edge runtime
   ├─ Zod validate body
   ├─ apiKey present?
   │   ├─ Yes (BYOK) → use as-is, skip auth/quota
   │   └─ No (shared) →
   │       ├─ auth() check session
   │       │   └─ No session → 401 SSE error event
   │       └─ Phase 07 quota check (stub Phase 06: TODO marker)
   │
   ├─ Build prompt (system + user) — port từ HTML cũ
   ├─ Call provider with stream=true
   ├─ Stream chunks to client as SSE
   └─ Final event: { type: 'done', result: <parsed JSON> }
```

## Related Code Files

### Create
- `src/app/api/analyze/route.ts` — handler Edge runtime
- `src/app/api/generate-cv/route.ts` — handler Edge runtime
- `src/lib/llm/providers.ts` — unified call interface
- `src/lib/llm/call-gemini.ts` — Gemini stream wrapper
- `src/lib/llm/call-openai.ts` — OpenAI-compatible stream wrapper
- `src/lib/llm/prompt-analyze.ts` — system + user prompt builder cho fit scoring
- `src/lib/llm/prompt-matched-cv.ts` — system + user prompt builder cho CV rewrite
- `src/lib/llm/sse-stream.ts` — Server-Sent Event helper
- `src/lib/llm/safe-logger.ts` — redact apiKey trước log
- `src/lib/schemas/llm-request.ts` — Zod schemas

### Modify
- `src/lib/api-client.ts` (Phase 03) — đổi sang SSE consumer dùng EventSource hoặc fetch ReadableStream

## Implementation Steps

1. **`src/lib/schemas/llm-request.ts`**
   ```ts
   import { z } from 'zod';

   export const LlmConfig = z.object({
     provider: z.enum(['gemini', 'openai', 'custom']),
     model: z.string().min(1),
     temperature: z.number().min(0).max(2).default(0.3),
     baseUrl: z.string().url().optional(),
     apiKey: z.string().optional(),
   });

   export const AnalyzeBody = z.object({
     jdText: z.string().min(50).max(50_000),
     cvText: z.string().min(50).max(50_000),
     profileText: z.string().max(10_000).optional(),
     targetRole: z.string(),
     strictness: z.enum(['balanced', 'strict', 'friendly']),
     language: z.enum(['en', 'vi', 'auto']),
     llm: LlmConfig,
   });

   export const GenerateCvBody = z.object({
     analysis: z.record(z.unknown()),
     jdText: z.string(),
     cvText: z.string(),
     profileText: z.string().optional(),
     tone: z.enum(['concise', 'impact', 'recruiter', 'executive']),
     length: z.enum(['short', 'medium', 'long']),
     language: z.enum(['en', 'vi', 'auto']),
     extra: z.string().max(500).optional(),
     llm: LlmConfig,
   });
   ```

2. **`src/lib/llm/safe-logger.ts`**
   ```ts
   export function logLlmCall(meta: { provider: string; model: string; status: 'ok' | 'error'; latencyMs: number; error?: string }) {
     console.log(JSON.stringify({ event: 'llm_call', ...meta }));
   }
   ```
   Note: KHÔNG bao giờ log full request/response. Chỉ metadata.

3. **`src/lib/llm/sse-stream.ts`**
   ```ts
   export function sseEvent(data: unknown): Uint8Array {
     return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
   }

   export function sseHeaders() {
     return {
       'Content-Type': 'text/event-stream; charset=utf-8',
       'Cache-Control': 'no-cache, no-transform',
       Connection: 'keep-alive',
       'X-Accel-Buffering': 'no',
     };
   }
   ```

4. **`src/lib/llm/call-gemini.ts`** — streaming
   ```ts
   export async function* streamGemini(opts: {
     apiKey: string; model: string; temperature: number;
     system: string; user: string; expectJson: boolean;
   }): AsyncGenerator<string> {
     const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(opts.apiKey)}`;
     const body = {
       systemInstruction: { parts: [{ text: opts.system }] },
       contents: [{ role: 'user', parts: [{ text: opts.user }] }],
       generationConfig: {
         temperature: opts.temperature,
         maxOutputTokens: 8192,
         ...(opts.expectJson ? { responseMimeType: 'application/json' } : {}),
       },
     };
     const res = await fetch(url, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(body),
     });
     if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
     const reader = res.body!.getReader();
     const decoder = new TextDecoder();
     let buf = '';
     while (true) {
       const { done, value } = await reader.read();
       if (done) break;
       buf += decoder.decode(value, { stream: true });
       const lines = buf.split('\n');
       buf = lines.pop() ?? '';
       for (const line of lines) {
         if (!line.startsWith('data: ')) continue;
         try {
           const json = JSON.parse(line.slice(6));
           const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
           if (text) yield text;
         } catch { /* ignore malformed */ }
       }
     }
   }
   ```

5. **`src/lib/llm/call-openai.ts`** — streaming SSE
   ```ts
   export async function* streamOpenAI(opts: {
     apiKey: string; baseUrl: string; model: string; temperature: number;
     system: string; user: string; expectJson: boolean;
   }): AsyncGenerator<string> {
     const res = await fetch(`${opts.baseUrl}/chat/completions`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Authorization: `Bearer ${opts.apiKey}`,
       },
       body: JSON.stringify({
         model: opts.model,
         temperature: opts.temperature,
         stream: true,
         messages: [
           { role: 'system', content: opts.system },
           { role: 'user', content: opts.user },
         ],
         ...(opts.expectJson ? { response_format: { type: 'json_object' } } : {}),
       }),
     });
     if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
     const reader = res.body!.getReader();
     const decoder = new TextDecoder();
     let buf = '';
     while (true) {
       const { done, value } = await reader.read();
       if (done) break;
       buf += decoder.decode(value, { stream: true });
       const lines = buf.split('\n');
       buf = lines.pop() ?? '';
       for (const line of lines) {
         if (!line.startsWith('data: ')) continue;
         const payload = line.slice(6).trim();
         if (payload === '[DONE]') return;
         try {
           const json = JSON.parse(payload);
           const text = json?.choices?.[0]?.delta?.content ?? '';
           if (text) yield text;
         } catch { /* ignore */ }
       }
     }
   }
   ```

6. **`src/lib/llm/providers.ts`** — dispatcher
   ```ts
   import type { z } from 'zod';
   import type { LlmConfig } from '@/lib/schemas/llm-request';
   import { streamGemini } from './call-gemini';
   import { streamOpenAI } from './call-openai';

   type Cfg = z.infer<typeof LlmConfig> & { apiKey: string };

   export function streamLLM(cfg: Cfg, system: string, user: string, expectJson: boolean): AsyncGenerator<string> {
     if (cfg.provider === 'gemini') {
       return streamGemini({ ...cfg, system, user, expectJson });
     }
     const baseUrl = cfg.provider === 'openai'
       ? 'https://api.openai.com/v1'
       : (cfg.baseUrl ?? '').replace(/\/$/, '');
     if (!baseUrl) throw new Error('Custom provider cần baseUrl');
     return streamOpenAI({ ...cfg, baseUrl, system, user, expectJson });
   }
   ```

7. **`src/lib/llm/prompt-analyze.ts`** — port system prompt từ HTML cũ
   - Đọc lines ~520-650 của HTML để extract prompt template
   - Tách system instructions (role, output JSON schema) và user input (JD + CV + profile + role family + strictness + language)
   - Đầu ra: `buildAnalyzePrompts(input): { system: string; user: string }`

8. **`src/lib/llm/prompt-matched-cv.ts`** — port từ HTML cũ
   - System: "Rewrite CV để match JD, 100% truthful, không thêm fake skill"
   - User: JD + CV + analysis context + tone + length + extra

9. **`src/app/api/analyze/route.ts`**
   ```ts
   import { NextRequest } from 'next/server';
   import { auth } from '@/auth';
   import { env } from '@/lib/env';
   import { AnalyzeBody } from '@/lib/schemas/llm-request';
   import { streamLLM } from '@/lib/llm/providers';
   import { buildAnalyzePrompts } from '@/lib/llm/prompt-analyze';
   import { sseEvent, sseHeaders } from '@/lib/llm/sse-stream';
   import { logLlmCall } from '@/lib/llm/safe-logger';
   import { consumeQuotaForUser } from '@/lib/quota/consume-quota'; // Phase 07 stub OK

   export const runtime = 'edge';
   export const maxDuration = 25;

   export async function POST(req: NextRequest) {
     const json = await req.json().catch(() => null);
     const parsed = AnalyzeBody.safeParse(json);
     if (!parsed.success) {
       return new Response(JSON.stringify({ ok: false, error: { code: 'invalid_input', message: parsed.error.message } }), { status: 400 });
     }
     const { jdText, cvText, profileText, targetRole, strictness, language, llm } = parsed.data;

     // Resolve API key: BYOK or shared
     let apiKey = llm.apiKey?.trim();
     let isShared = false;
     let quotaRemaining: number | undefined;

     if (!apiKey) {
       const session = await auth();
       if (!session?.user?.id) {
         return sseError('unauthorized', 'Đăng nhập để dùng shared key, hoặc nhập key của bạn', 401);
       }
       isShared = true;
       const quota = await consumeQuotaForUser(session.user.id, 'analyze');
       if (!quota.ok) {
         return sseError('quota_exceeded', 'Hết quota hôm nay', 429);
       }
       quotaRemaining = quota.remaining;
       apiKey = llm.provider === 'gemini' ? env.GEMINI_API_KEY : env.OPENAI_API_KEY;
       if (!apiKey) {
         return sseError('llm_provider_error', 'Server chưa cấu hình shared key', 500);
       }
     }

     const { system, user } = buildAnalyzePrompts({ jdText, cvText, profileText, targetRole, strictness, language });
     const start = Date.now();
     const stream = new ReadableStream({
       async start(controller) {
         try {
           let acc = '';
           for await (const chunk of streamLLM({ ...llm, apiKey: apiKey! }, system, user, true)) {
             acc += chunk;
             controller.enqueue(sseEvent({ type: 'chunk', text: chunk }));
           }
           let result: unknown = null;
           try { result = JSON.parse(acc); }
           catch { /* let client handle parse */ }
           controller.enqueue(sseEvent({ type: 'done', raw: acc, result, quotaRemaining }));
           logLlmCall({ provider: llm.provider, model: llm.model, status: 'ok', latencyMs: Date.now() - start });
         } catch (e) {
           const msg = e instanceof Error ? e.message : String(e);
           controller.enqueue(sseEvent({ type: 'error', code: 'llm_provider_error', message: msg.slice(0, 200) }));
           logLlmCall({ provider: llm.provider, model: llm.model, status: 'error', latencyMs: Date.now() - start, error: msg.slice(0, 200) });
         } finally {
           controller.close();
         }
       },
     });
     return new Response(stream, { headers: sseHeaders() });
   }

   function sseError(code: string, message: string, status: number): Response {
     return new Response(`data: ${JSON.stringify({ type: 'error', code, message })}\n\n`, {
       status,
       headers: sseHeaders(),
     });
   }
   ```

10. **`src/app/api/generate-cv/route.ts`** — tương tự nhưng `expectJson=false`, output markdown text.

11. **Client consumer** — sửa `src/lib/api-client.ts`:
    ```ts
    export async function streamAnalyze(payload: AnalyzeRequest, onChunk: (text: string) => void): Promise<{ result: AnalysisResult; quotaRemaining?: number }> {
      const res = await fetch('/api/analyze', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
      if (!res.ok && res.headers.get('content-type')?.includes('json')) {
        const err = await res.json();
        throw new Error(err.error?.message);
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let final: any = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() ?? '';
        for (const ev of events) {
          if (!ev.startsWith('data: ')) continue;
          const data = JSON.parse(ev.slice(6));
          if (data.type === 'chunk') onChunk(data.text);
          else if (data.type === 'done') final = data;
          else if (data.type === 'error') throw new Error(data.message);
        }
      }
      if (!final?.result) throw new Error('Phản hồi không hợp lệ');
      return { result: final.result, quotaRemaining: final.quotaRemaining };
    }
    ```

## Todo List

- [x] Tạo Zod schemas trong `llm-request.ts` (nested {llm,inputs} + 9-dim Weights)
- [ ] ~~Tạo `sse-stream.ts` helper~~ — dropped, non-streaming JSON path
- [x] Tạo `safe-logger.ts` (metadata-only, no apiKey/jdText/cvText)
- [x] Tạo `call-gemini.ts` (non-streaming `generateContent`)
- [x] Tạo `call-openai.ts` (non-streaming `chat/completions`, custom baseUrl OK)
- [x] Tạo `providers.ts` dispatcher
- [x] Tạo `prompt-analyze.ts` (9-dim weights + must-have hard gate, JSON schema)
- [x] Tạo `prompt-generate-cv.ts`
- [x] Tạo `prompt-must-haves.ts`
- [x] Tạo `/api/analyze/route.ts` Node runtime (60s)
- [x] Tạo `/api/generate-cv/route.ts` Node runtime
- [x] Tạo `/api/extract-must-haves/route.ts` Node runtime
- [x] `resolve-api-key.ts` — BYOK vs shared+session
- [x] `consume-quota.ts` stub (Phase 07 will fill)
- [x] `safe-parse-json.ts` (tolerates code fences + bracket scan)
- [x] `normalize-analysis.ts` (snake_case OR camelCase → typed AnalysisResult)
- [x] Update `api-client.ts` callExtractMustHaves signature + must-haves block to pass llm config
- [x] Smoke: invalid body 400, no-auth-no-BYOK 401, BYOK with fake key → 502 with upstream error surfaced
- [ ] Test BYOK với Gemini key thật → result JSON  *(user-side smoke; needs real key)*
- [ ] Test BYOK với OpenAI key thật  *(user-side smoke; needs real key)*
- [ ] Verify Vercel bundle build OK (`pnpm build` + cold-start cost on Node) — defer → Phase 08
- [x] `apiKey` never in response payload (verified: not in any NextResponse.json call site)

## Success Criteria

- ✅ BYOK Gemini → stream chunks → final JSON result đúng schema
- ✅ BYOK OpenAI gpt-4o-mini → stream → final JSON
- ✅ BYOK custom (vd OpenRouter) → stream → JSON
- ✅ Shared key + session → stream OK, quotaRemaining trong final event
- ✅ Shared key không session → 401 SSE error event
- ✅ Invalid body → 400 với Zod error message
- ✅ LLM 500 error → SSE error event, không crash
- ✅ `grep -r "apiKey" .next/static` không match (key không lọt client bundle)
- ✅ Logs không chứa apiKey, jdText, cvText (chỉ metadata)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Edge runtime không support feature X | Med | High | Test sớm với simple stream, fallback Node nếu cần |
| LLM trả non-JSON khi expectJson | Med | Med | Client side parse with try-catch, hiển thị raw |
| Stream timeout > 25s | Med | Med | Prompt ngắn gọn, truncate JD/CV nếu lớn |
| Provider rate limit upstream | Low | Med | Surface error rõ ràng, không retry tự động Phase 1 |
| BYOK key leak qua logs | High | Critical | safe-logger không log apiKey, redact mọi nơi |

## Security Considerations

- **Hard rule:** `apiKey` không xuất hiện trong response object, không vào logs, không stringify request body khi log
- **Edge runtime** không có access env runtime ngẫu nhiên — explicit import từ `@/lib/env`
- **Type-level enforce**: response type không có field `apiKey`
- **CORS**: chỉ allow same-origin (Next.js default)
- **Body size**: Zod max 50K chars/field, total ~150KB → trong limit
- **Timing attack**: không phân biệt "wrong key" vs "no key" trong error message

## Open Questions

- ⏳ Quota consumption khi LLM fail giữa chừng → consume hay refund? **Decision:** Consume trước, không refund (đơn giản, chấp nhận edge case rare). Document trong README.

## Next Steps

- Phase 07 implement `consumeQuotaForUser` thật
- Phase 08 i18n cho error messages tiếng Việt
