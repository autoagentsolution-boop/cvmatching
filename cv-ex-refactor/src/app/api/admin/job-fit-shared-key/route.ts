// Admin-only POST: flip the job-fit shared-key bypass KV flag. Same shape
// as /api/admin/login-flag. See lib/maintenance/job-fit-shared-key-flag.ts
// for the policy rationale.

import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import {
  JOB_FIT_SHARED_KEY_FLAG,
  resetJobFitSharedKeyCache,
} from '@/lib/maintenance/job-fit-shared-key-flag';

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
    await kv.set(JOB_FIT_SHARED_KEY_FLAG, '1');
  } else if (action === 'off') {
    await kv.del(JOB_FIT_SHARED_KEY_FLAG);
  } else {
    return NextResponse.json(
      { ok: false, error: 'action must be "on" or "off"' },
      { status: 400 },
    );
  }

  resetJobFitSharedKeyCache();
  return NextResponse.json({ ok: true, action });
}
