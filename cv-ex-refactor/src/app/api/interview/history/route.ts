// GET /api/interview/history?limit=N — recent sessions for the dashboard widget.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { InterviewHistoryQuery } from '@/lib/schemas/interview-request';
import { listUserHistory } from '@/lib/interview/storage';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return err('auth_required', 'Authentication required.', 401);

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = InterviewHistoryQuery.safeParse(params);
  if (!parsed.success) {
    return err('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid query.', 400);
  }

  const rows = await listUserHistory(session.user.id, parsed.data.limit);
  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      mode: r.mode,
      jobId: r.jobId,
      roleTitle: r.roleTitle,
      anchorRoleTitle: r.anchorRoleTitle,
      status: r.status,
      // overallScore is stored as 0..100 INTEGER; expose as 0..10 float.
      overallScore: r.overallScore == null ? null : r.overallScore / 10,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  });
}
