import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { currentYm, getUsageSnapshot } from '@/lib/usage/read-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',');
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!isAdminUser(session?.user)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const month = req.nextUrl.searchParams.get('month') ?? currentYm();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'invalid_month' }, { status: 400 });
  }

  const snapshot = await getUsageSnapshot(month, 30);

  const lines: string[] = [];
  lines.push(row([
    'user_id',
    'analyze',
    'generate_cv',
    'extract_must_haves',
    'shared',
    'byok',
    'chars',
    'tokens',
    'cost_micro_usd',
    'cost_usd',
  ]));

  for (const u of snapshot.users) {
    lines.push(row([
      u.userId,
      u.analyze,
      u.generateCv,
      u.extractMustHaves,
      u.shared,
      u.byok,
      u.charVolume,
      u.tokens,
      u.costMicroUsd,
      (u.costMicroUsd / 1_000_000).toFixed(6),
    ]));
  }

  const csv = lines.join('\n') + '\n';

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="usage-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
