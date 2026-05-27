import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAnonQuotaStatus, getQuotaStatus } from '@/lib/quota/get-quota-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth().catch(() => null);
  if (session?.user?.id) {
    const status = await getQuotaStatus(session.user.id);
    return NextResponse.json({ ok: true, scope: 'user', ...status });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown';
  const status = await getAnonQuotaStatus(ip);
  return NextResponse.json({ ok: true, scope: 'anon', ...status });
}
