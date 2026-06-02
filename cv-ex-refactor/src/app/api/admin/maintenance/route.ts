// Admin-only POST: flip the maintenance:mode KV flag from the dashboard
// without dropping to CLI. Mirrors scripts/maintenance-mode.ts exactly.

import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { MAINTENANCE_KEY, resetMaintenanceCache } from '@/lib/maintenance/maintenance-mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!isAdminUser(session?.user)) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (!kvAvailable) {
    return NextResponse.json(
      { ok: false, error: 'KV not configured' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;

  if (action === 'on') {
    await kv.set(MAINTENANCE_KEY, '1');
  } else if (action === 'off') {
    await kv.del(MAINTENANCE_KEY);
  } else {
    return NextResponse.json(
      { ok: false, error: 'action must be "on" or "off"' },
      { status: 400 },
    );
  }

  resetMaintenanceCache();
  return NextResponse.json({ ok: true, action });
}
