import type { NextRequest } from 'next/server';
import { kv, kvAvailable } from './kv-client';

export interface RateLimitConfig {
  endpoint: string;
  max: number;
  windowSec?: number;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

function resolveIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown';
}

export async function enforceIpRateLimit(
  req: NextRequest,
  cfg: RateLimitConfig,
): Promise<RateLimitResult> {
  if (!kvAvailable) return { ok: true };

  const windowSec = cfg.windowSec ?? 60;
  const ip = resolveIp(req);
  const nowSec = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSec / windowSec);
  const key = `r:${cfg.endpoint}:${ip}:${bucket}`;

  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, windowSec + 10);
    }
    if (count > cfg.max) {
      const retryAfterSec = windowSec - (nowSec % windowSec);
      return { ok: false, retryAfterSec };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[ratelimit] kv_incr_failed', {
      endpoint: cfg.endpoint,
      message: e instanceof Error ? e.message : String(e),
    });
    return { ok: true };
  }
}

export function rateLimitedResponse(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code: 'rate_limited', message: 'Quá nhiều request. Vui lòng thử lại sau.' },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSec),
      },
    },
  );
}
