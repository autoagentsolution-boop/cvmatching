// GET  /api/cvs  — list authenticated user's CV library
// POST /api/cvs  — create a new CV entry

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { listUserCvs, createUserCv } from '@/lib/cvs/repo';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

// ─── GET /api/cvs ─────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return err('unauthorized', 'Authentication required.', 401);
  }

  try {
    const cvs = await listUserCvs(session.user.id);
    return NextResponse.json({ ok: true, cvs });
  } catch (e) {
    console.error('[api/cvs] list_failed', {
      userId: session.user.id,
      message: e instanceof Error ? e.message : String(e),
    });
    return err('internal_error', 'Failed to fetch CV list.', 500);
  }
}

// ─── POST /api/cvs ────────────────────────────────────────────────────────

const CreateCvBody = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1).max(50_000),
  isDefault: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return err('unauthorized', 'Authentication required.', 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const parsed = CreateCvBody.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    const msg = issue?.message ?? 'Invalid body.';
    return err('invalid_input', path ? `${path}: ${msg}` : msg, 400);
  }

  try {
    const cv = await createUserCv(session.user.id, parsed.data);
    return NextResponse.json({ ok: true, cv }, { status: 201 });
  } catch (e) {
    console.error('[api/cvs] create_failed', {
      userId: session.user.id,
      message: e instanceof Error ? e.message : String(e),
    });
    return err('internal_error', 'Failed to create CV.', 500);
  }
}
