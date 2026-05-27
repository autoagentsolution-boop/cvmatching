import { type NextRequest, NextResponse } from 'next/server';
import { clearKey, BYOK_COOKIE_NAME } from '@/lib/byok-vault/store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(BYOK_COOKIE_NAME)?.value;
  await clearKey(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: BYOK_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return res;
}
