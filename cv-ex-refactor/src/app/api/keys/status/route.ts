import { type NextRequest, NextResponse } from 'next/server';
import { getKeyTail, BYOK_COOKIE_NAME } from '@/lib/byok-vault/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(BYOK_COOKIE_NAME)?.value;
  const tail = await getKeyTail(token);
  return NextResponse.json({ hasKey: tail !== null, tail });
}
