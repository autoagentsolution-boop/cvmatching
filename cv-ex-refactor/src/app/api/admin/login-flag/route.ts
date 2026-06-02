// Admin-only POST: flip the login:enabled KV flag. Mirror of the maintenance
// route — wraps the same on/off/cache-reset pattern.

import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { LOGIN_FLAG_KEY, resetLoginFlagCache } from '@/lib/maintenance/login-flag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!isAdminUser(session?.user)) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (!kvAvailable) {
    return NextResponse.json({ ok: false, error: 'KV not configured' }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;

  if (action === 'on') {
    await kv.set(LOGIN_FLAG_KEY, '1');
  } else if (action === 'off') {
    await kv.del(LOGIN_FLAG_KEY);
  } else {
    return NextResponse.json(
      { ok: false, error: 'action must be "on" or "off"' },
      { status: 400 },
    );
  }

  resetLoginFlagCache();
  return NextResponse.json({ ok: true, action });
}
