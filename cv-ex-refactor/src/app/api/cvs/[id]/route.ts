// PATCH  /api/cvs/[id]  — rename / replace content / toggle default
// DELETE /api/cvs/[id]  — hard delete

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getUserCv, updateUserCv, deleteUserCv } from '@/lib/cvs/repo';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

// ─── PATCH /api/cvs/[id] ─────────────────────────────────────────────────

const PatchCvBody = z
  .object({
    name: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(50_000).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.content !== undefined || v.isDefault !== undefined, {
    message: 'At least one field (name, content, isDefault) must be provided.',
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return err('unauthorized', 'Authentication required.', 401);
  }

  const { id: cvId } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const parsed = PatchCvBody.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    const msg = issue?.message ?? 'Invalid body.';
    return err('invalid_input', path ? `${path}: ${msg}` : msg, 400);
  }

  try {
    const cv = await updateUserCv(session.user.id, cvId, parsed.data);
    if (!cv) {
      // Return 404 regardless of whether ID exists under another user — no info leak.
      return err('not_found', 'CV not found.', 404);
    }
    return NextResponse.json({ ok: true, cv });
  } catch (e) {
    console.error('[api/cvs/[id]] patch_failed', {
      userId: session.user.id,
      cvId,
      message: e instanceof Error ? e.message : String(e),
    });
    return err('internal_error', 'Failed to update CV.', 500);
  }
}

// ─── DELETE /api/cvs/[id] ────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return err('unauthorized', 'Authentication required.', 401);
  }

  const { id: cvId } = await params;

  // Confirm ownership before delete — deleteUserCv already filters by userId
  // but we need a 404 response when the row is not found.
  try {
    const existing = await getUserCv(session.user.id, cvId);
    if (!existing) {
      return err('not_found', 'CV not found.', 404);
    }

    await deleteUserCv(session.user.id, cvId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('[api/cvs/[id]] delete_failed', {
      userId: session.user.id,
      cvId,
      message: e instanceof Error ? e.message : String(e),
    });
    return err('internal_error', 'Failed to delete CV.', 500);
  }
}
