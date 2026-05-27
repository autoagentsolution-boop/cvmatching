import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storeKey, BYOK_COOKIE_NAME, BYOK_COOKIE_MAX_AGE } from '@/lib/byok-vault/store';
import { enforceIpRateLimit, rateLimitedResponse } from '@/lib/quota/enforce-ip-rate-limit';

export const runtime = 'nodejs';

const Body = z.object({ apiKey: z.string().min(8).max(512) });

export async function POST(req: NextRequest) {
  const rate = await enforceIpRateLimit(req, { endpoint: '/api/keys/store', max: 10, windowSec: 60 });
  if (!rate.ok) return rateLimitedResponse(rate.retryAfterSec);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_input', message: 'API key không hợp lệ.' } },
      { status: 400 },
    );
  }

  const token = await storeKey(parsed.data.apiKey);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: { code: 'vault_unavailable', message: 'Hệ thống lưu key tạm thời không khả dụng.' } },
      { status: 503 },
    );
  }

  const tail = parsed.data.apiKey.trim().slice(-4);
  const res = NextResponse.json({ ok: true, tail });
  res.cookies.set({
    name: BYOK_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: BYOK_COOKIE_MAX_AGE,
  });
  return res;
}
