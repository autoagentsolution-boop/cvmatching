import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getQuotaStatus } from '@/lib/quota/get-quota-status';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Đăng nhập để xem quota.' } },
      { status: 401 },
    );
  }

  const status = await getQuotaStatus(session.user.id);
  return NextResponse.json({ ok: true, ...status });
}
