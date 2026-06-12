// GET /api/interview/[id] — load full session for the owner.
//
// 404 (not 403) on ownership mismatch by design — prevents existence-leak
// about other users' sessions. Rubric is stripped from the response while
// status='in_progress'; once 'completed' the rubric is preserved so the
// results page can show why each grade landed where it did.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSessionById } from '@/lib/interview/storage';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return err('auth_required', 'Authentication required.', 401);
  const userId = session.user.id;

  const { id } = await params;
  const persisted = await getSessionById(id, userId);
  if (!persisted) return err('not_found', 'Phiên không tồn tại.', 404);

  // In progress: strip rubric so the user can't see grading criteria before
  // submitting. Completed: keep rubric so results page renders criteria +
  // signals + grade side-by-side.
  const inProgress = persisted.status === 'in_progress';
  return NextResponse.json({
    id: persisted.id,
    mode: persisted.mode,
    jobId: persisted.jobId,
    roleTitle: persisted.roleTitle,
    anchorRoleTitle: persisted.anchorRoleTitle,
    status: persisted.status,
    overallScore: persisted.overallScore == null ? null : persisted.overallScore / 10,
    createdAt: persisted.createdAt.toISOString(),
    completedAt: persisted.completedAt?.toISOString() ?? null,
    dualLens: persisted.dualLens,
    questions: inProgress
      ? persisted.questions.map((q) => ({ id: q.id, type: q.type, question: q.question }))
      : persisted.questions,
  });
}
