// Admin-only POST: flip the Luyện phỏng vấn kill-switch. Mirrors the
// job-fit-flag + login-flag pattern. See lib/maintenance/interview-flag.ts
// for default-ON semantics.

import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { INTERVIEW_FLAG, resetInterviewFlagCache } from '@/lib/maintenance/interview-flag';

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
    await kv.del(INTERVIEW_FLAG);
  } else if (action === 'off') {
    await kv.set(INTERVIEW_FLAG, '0');
  } else {
    return NextResponse.json(
      { ok: false, error: 'action must be "on" or "off"' },
      { status: 400 },
    );
  }

  resetInterviewFlagCache();
  return NextResponse.json({ ok: true, action });
}
