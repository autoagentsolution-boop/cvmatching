# Phase 07 — Quota & Rate Limiting

## Context

- **Brainstorm:** [../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md](../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md)
- **Priority:** P0
- **Status:** pending
- **Depends on:** Phase 02 (auth), Phase 06 (LLM endpoint hooks)
- **Estimated effort:** 3-4 hours

## Overview

Vercel KV (Upstash Redis) backend. 2 lớp protection:
1. **Per-user daily quota** cho shared key: 5 analyses + 2 CV rewrites/ngày, reset 00:00 UTC+7
2. **Per-IP rate limit** cho `/api/scrape` + `/api/parse`: 60 req/min/IP chống abuse BYOK path

## Key Insights

- **Vercel KV** = Upstash Redis client behind facade. Free tier 30K commands/day.
- Atomic INCR + EXPIRE đảm bảo race-condition free
- Key naming: `quota:{userId}:{YYYY-MM-DD}:{kind}` ; `ratelimit:{endpoint}:{ip}:{minute}`
- Timezone: VN (UTC+7) — compute "today" theo VN, không UTC
- KV down → fail-open (allow request, log warning) để không break UX

## Requirements

### Functional
- `consumeQuotaForUser(userId, kind: 'analyze' | 'generate_cv')` — atomic check + increment
- Limits: 5 analyses, 2 generate_cv per user per VN day
- Day boundary: 00:00 Asia/Bangkok (UTC+7)
- `GET /api/quota` → trả `{ analyze: { used, limit, remaining }, generate_cv: { ... } }`
- IP rate limit middleware-style wrapper cho `/api/scrape`, `/api/parse`
- Returns 429 với Retry-After header

### Non-functional
- KV op latency < 50ms p99
- Failure-open khi KV down (log warning, allow)
- Type-safe API

## Architecture

```
                 ┌─────────────────────────────────┐
                 │   Vercel KV (Upstash Redis)     │
                 └─────────────────────────────────┘
                              ▲
              ┌───────────────┼───────────────┐
              │               │               │
   consumeQuota    enforceIpRateLimit    getQuotaStatus
              │               │               │
              ▼               ▼               ▼
       /api/analyze      /api/scrape       /api/quota
       /api/generate-cv  /api/parse
```

### Keys

- Quota: `q:{userId}:{YYYY-MM-DD}:{kind}` — INT, TTL 24h
- IP rate: `r:{endpoint}:{ip}:{YYYYMMDDHHmm}` — INT, TTL 70s

### Limits

```ts
const QUOTA_LIMITS = {
  analyze: 5,
  generate_cv: 2,
} as const;

const IP_RATE = {
  '/api/scrape': { window: 60, max: 30 },
  '/api/parse':  { window: 60, max: 30 },
} as const;
```

## Related Code Files

### Create
- `src/lib/quota/kv-client.ts` — wrap @vercel/kv, single source
- `src/lib/quota/consume-quota.ts` — user-level quota
- `src/lib/quota/get-quota-status.ts` — read-only status
- `src/lib/quota/enforce-ip-rate-limit.ts` — IP middleware
- `src/lib/quota/vn-date.ts` — UTC+7 date helper
- `src/app/api/quota/route.ts` — GET endpoint

### Modify
- `src/app/api/analyze/route.ts` — wire real quota
- `src/app/api/generate-cv/route.ts` — wire real quota
- `src/app/api/scrape/route.ts` — wrap với IP rate limit
- `src/app/api/parse/route.ts` — wrap với IP rate limit

## Implementation Steps

1. **Provisioning Vercel KV**
   - Vercel dashboard → Storage → Create KV → link vào project
   - Auto-inject env vars: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`
   - Pull về local: `pnpm dlx vercel env pull .env.local`

2. **`src/lib/quota/kv-client.ts`**
   ```ts
   import { kv } from '@vercel/kv';
   export { kv };
   ```

3. **`src/lib/quota/vn-date.ts`** — VN date string
   ```ts
   export function vnDateString(now: Date = new Date()): string {
     // VN = UTC+7. Add 7h then take ISO date.
     const vn = new Date(now.getTime() + 7 * 3600 * 1000);
     return vn.toISOString().slice(0, 10); // YYYY-MM-DD
   }

   export function secondsUntilVnMidnight(now: Date = new Date()): number {
     const vn = new Date(now.getTime() + 7 * 3600 * 1000);
     const next = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + 1));
     return Math.ceil((next.getTime() - vn.getTime()) / 1000);
   }
   ```

4. **`src/lib/quota/consume-quota.ts`**
   ```ts
   import { kv } from './kv-client';
   import { vnDateString, secondsUntilVnMidnight } from './vn-date';

   export const QUOTA_LIMITS = { analyze: 5, generate_cv: 2 } as const;
   export type QuotaKind = keyof typeof QUOTA_LIMITS;

   export type ConsumeResult =
     | { ok: true; remaining: number; used: number; limit: number }
     | { ok: false; reason: 'exceeded'; used: number; limit: number; resetInSec: number };

   export async function consumeQuotaForUser(userId: string, kind: QuotaKind): Promise<ConsumeResult> {
     const day = vnDateString();
     const key = `q:${userId}:${day}:${kind}`;
     const limit = QUOTA_LIMITS[kind];
     try {
       const used = await kv.incr(key);
       if (used === 1) {
         await kv.expire(key, secondsUntilVnMidnight() + 60);
       }
       if (used > limit) {
         return { ok: false, reason: 'exceeded', used: used - 1, limit, resetInSec: secondsUntilVnMidnight() };
       }
       return { ok: true, remaining: limit - used, used, limit };
     } catch (e) {
       console.warn('quota_kv_fail', e instanceof Error ? e.message : String(e));
       return { ok: true, remaining: limit, used: 0, limit }; // fail-open
     }
   }
   ```

5. **`src/lib/quota/get-quota-status.ts`**
   ```ts
   import { kv } from './kv-client';
   import { vnDateString } from './vn-date';
   import { QUOTA_LIMITS, QuotaKind } from './consume-quota';

   export async function getQuotaStatus(userId: string) {
     const day = vnDateString();
     const kinds: QuotaKind[] = ['analyze', 'generate_cv'];
     const out: Record<string, { used: number; limit: number; remaining: number }> = {};
     await Promise.all(kinds.map(async (k) => {
       try {
         const used = (await kv.get<number>(`q:${userId}:${day}:${k}`)) ?? 0;
         out[k] = { used, limit: QUOTA_LIMITS[k], remaining: Math.max(0, QUOTA_LIMITS[k] - used) };
       } catch {
         out[k] = { used: 0, limit: QUOTA_LIMITS[k], remaining: QUOTA_LIMITS[k] };
       }
     }));
     return out;
   }
   ```

6. **`src/lib/quota/enforce-ip-rate-limit.ts`**
   ```ts
   import { kv } from './kv-client';
   import { NextRequest } from 'next/server';

   type Result = { ok: true } | { ok: false; retryAfterSec: number };

   export async function enforceIpRateLimit(req: NextRequest, endpoint: string, max: number, windowSec = 60): Promise<Result> {
     const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('x-real-ip')
            ?? 'unknown';
     const minuteBucket = Math.floor(Date.now() / 1000 / windowSec);
     const key = `r:${endpoint}:${ip}:${minuteBucket}`;
     try {
       const count = await kv.incr(key);
       if (count === 1) await kv.expire(key, windowSec + 10);
       if (count > max) {
         const retryAfterSec = windowSec - (Math.floor(Date.now() / 1000) % windowSec);
         return { ok: false, retryAfterSec };
       }
       return { ok: true };
     } catch {
       return { ok: true }; // fail-open
     }
   }
   ```

7. **`src/app/api/quota/route.ts`**
   ```ts
   import { NextResponse } from 'next/server';
   import { auth } from '@/auth';
   import { getQuotaStatus } from '@/lib/quota/get-quota-status';

   export const runtime = 'nodejs';

   export async function GET() {
     const session = await auth();
     if (!session?.user?.id) {
       return NextResponse.json({ ok: false, error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });
     }
     const status = await getQuotaStatus(session.user.id);
     return NextResponse.json({ ok: true, quota: status });
   }
   ```

8. **Wire `consume-quota` vào `/api/analyze`** — đã có stub Phase 06, giờ replace bằng real impl.

9. **Wire IP rate limit vào `/api/scrape` + `/api/parse`** — đầu handler:
   ```ts
   const rate = await enforceIpRateLimit(req, '/api/scrape', 30, 60);
   if (!rate.ok) {
     return new Response(JSON.stringify({ ok: false, error: { code: 'rate_limited', message: 'Too many requests' } }), {
       status: 429,
       headers: { 'Content-Type': 'application/json', 'Retry-After': String(rate.retryAfterSec) },
     });
   }
   ```

10. **Client UI** — show quota counter
    - `src/components/layout/app-header.tsx`: fetch `/api/quota` khi logged in, hiển thị "5/5 analyses today"
    - Sau mỗi request shared → quotaRemaining từ SSE final event → update store

11. **Test scenarios**:
    - User login → 5 lần analyze liên tiếp → 6th → 429
    - User login → 2 generate_cv → 3rd → 429
    - Cùng user 2 device → counter shared
    - 35 req/phút từ 1 IP → req 31+ → 429 với Retry-After
    - KV simulate down (block env vars) → expect fail-open, log warning

## Todo List

- [ ] Provision Vercel KV, pull env vars
- [ ] Tạo `kv-client.ts`
- [ ] Tạo `vn-date.ts` với UTC+7 helpers
- [ ] Tạo `consume-quota.ts`
- [ ] Tạo `get-quota-status.ts`
- [ ] Tạo `enforce-ip-rate-limit.ts`
- [ ] Tạo `/api/quota/route.ts`
- [ ] Replace stub trong `/api/analyze` và `/api/generate-cv`
- [ ] Wrap `/api/scrape` và `/api/parse` với rate limit
- [ ] Update UI: header hiển thị quota counter
- [ ] Test 5 scenarios trong "Test scenarios" section
- [ ] Verify TTL set đúng (KV dashboard inspect)
- [ ] `pnpm tsc --noEmit` clean

## Success Criteria

- ✅ 5 analyses thành công, lần 6 → 429 với message "Hết quota"
- ✅ Lần 6 trả về `retryAfterSec` đúng (giây cho đến 00:00 UTC+7)
- ✅ 2 generate_cv OK, lần 3 → 429
- ✅ `/api/quota` GET → trả status đúng cho cả 2 kind
- ✅ 35 scrape req trong 1 phút → req 31 trở đi 429
- ✅ KV down → analyze vẫn pass (fail-open) + log warning
- ✅ Quota counter chính xác sau midnight VN (reset về 0)
- ✅ Same user 2 device → tổng counter ≤ limit

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Race condition giữa INCR và EXPIRE | Low | Med | INCR atomic, EXPIRE setup chỉ khi count=1, ok cho minor drift |
| KV miss tính tiền cao | Low | Low | 30K free → quota ops ~2/req → ~15K analyses/day OK |
| Fail-open bị abuse | Med | High | Alert nếu warning rate spike → manual disable shared key emergency |
| Timezone edge case (00:00:01) | Low | Low | Reset boundary có drift ±60s, chấp nhận |
| IPv6 + load balancer gây IP mis-attribute | Med | Low | `x-forwarded-for` first, fallback x-real-ip |

## Security Considerations

- **Fail-open chỉ khi KV down** — không khi check fail vì user
- **IP rate limit phụ trợ** chứ không primary defense — Vercel có DDoS built-in
- **No PII trong KV** — chỉ userId hash (NextAuth issued) và IP (transient)
- **TTL bắt buộc** — không có key zombie

## Operational Concerns

- Monitor: Vercel KV dashboard daily commands count
- Alert: nếu daily commands > 20K → có thể có abuse
- Emergency disable shared key: env var `DISABLE_SHARED_KEY=1` → analyze trả 503 cho non-BYOK

## Next Steps

- Phase 08 deploy production, verify quota reset midnight VN test thực
- Phase 2 có thể thêm quota tier (free / paid)
