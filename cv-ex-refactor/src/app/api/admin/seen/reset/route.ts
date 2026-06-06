// POST /api/admin/seen/reset — clear user_seen_job rows.
//
// Self-reset (any authed user): no body / empty body / userId === session.user.id.
// Foreign reset (admin only): ?userId=X — must pass isAdminUser check.
//
// QA helper: lets a tester re-see jobs they already saw, without waiting 90 days
// for the sliding TTL window to roll over.

import { NextResponse } from 'next/server';
import { clearSeenForUser } from '@/lib/jobs/mark-seen-for-user';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const target = new URL(req.url).searchParams.get('userId') ?? session.user.id;

  if (target !== session.user.id && !isAdminUser(session.user)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const deleted = await clearSeenForUser(target);
  return NextResponse.json({ ok: true, userId: target, deleted });
}
