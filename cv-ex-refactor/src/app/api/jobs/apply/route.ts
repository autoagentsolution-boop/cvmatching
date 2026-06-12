// POST /api/jobs/apply — record an "apply" click on a Job Fit recommendation.
//
// Idempotent fire-and-forget called from the Tier S/A "Apply ngay" button
// onClick handler (which then proceeds to open sourceUrl in a new tab).
// Second + subsequent clicks for the same (user, job) are a no-op courtesy
// of ON CONFLICT DO NOTHING on the composite PK — no error returned.
//
// Returns 204 on success/duplicate, 400 on invalid body, 401 unauthenticated.
// Insert errors (FK violation if job_id doesn't exist) → 409 so the client
// can distinguish from server errors and decline to retry.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, appliedJobs } from '@/db';
import { ensureUserRow } from '@/lib/cvs/repo';

export const runtime = 'nodejs';

const ApplyBodySchema = z.object({
  jobId: z.string().min(1).max(200),
  source: z.enum(['job_fit', 'manual']),
});

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return err('unauthorized', 'Authentication required.', 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('invalid_json', 'Request body must be valid JSON.', 400);
  }

  const parsed = ApplyBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err('invalid_input', issue?.message ?? 'Invalid request body.', 400);
  }

  const userId = session.user.id;
  const { jobId, source } = parsed.data;

  try {
    await ensureUserRow(userId, session.user.email ?? null);

    await getDb()
      .insert(appliedJobs)
      .values({ userId, jobId, source })
      .onConflictDoNothing();

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // FK violation on job_id (23503) → client supplied a job that doesn't
    // exist in our pool. Return 409 so client treats as data error, not 5xx.
    if (message.includes('23503')) {
      console.warn('[api/jobs/apply] unknown_job', { userId, jobId, source });
      return err('unknown_job', 'Job not found in pool.', 409);
    }
    console.error('[api/jobs/apply] insert_failed', { userId, jobId, source, message });
    return err('internal_error', 'Failed to record apply click.', 500);
  }
}
