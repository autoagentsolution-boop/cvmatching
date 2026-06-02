// Redirect proxy with click tracking.
// GET /api/r/[jobId] → 302 to job.sourceUrl with click metrics written to KV.
// runtime = 'nodejs': Upstash KV from Edge runtime is finicky on Windows dev
// and requires extra env config; nodejs is safe on all environments.

import { NextRequest, NextResponse } from 'next/server';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { vnDateString } from '@/lib/quota/vn-date';
import { getJob } from '@/lib/jobs/repo';

// Redirect requires KV to resolve jobId → sourceUrl.
// Without KV the service is non-functional — return 503 with clear message.

export const runtime = 'nodejs';

const JOB_ID_RE = /^[a-f0-9]{16}$/;
const CLICK_TTL_S = 2 * 24 * 60 * 60; // 2 days

function errJson(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  if (!JOB_ID_RE.test(jobId)) {
    return errJson('invalid_job_id', 'jobId must be 16 lowercase hex characters.', 400);
  }

  if (!kvAvailable) {
    return errJson('service_unavailable', 'KV not configured.', 503);
  }

  const job = await getJob(jobId);
  if (!job) {
    return errJson('not_found', 'Job not found.', 404);
  }

  // P1.1 — Validate scheme before redirect; block javascript:, data:, file:, etc.
  let target: URL;
  try {
    target = new URL(job.sourceUrl);
  } catch {
    console.warn('[r/[jobId]] invalid sourceUrl in KV', { jobId });
    return errJson('invalid_target', 'Job source URL is malformed.', 502);
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    console.warn('[r/[jobId]] non-http(s) scheme blocked', { jobId, protocol: target.protocol });
    return errJson('invalid_target', 'Refusing non-http(s) redirect.', 502);
  }

  // Increment click metrics (blocking; comment was misleading — removed)
  if (kvAvailable) {
    const ymd = vnDateString();
    const perJobKey = `metrics:click:${jobId}:${ymd}`;
    const totalKey = `metrics:click:total:${ymd}`;
    await Promise.allSettled([
      kv.incr(perJobKey).then(() => kv.expire(perJobKey, CLICK_TTL_S)),
      kv.incr(totalKey).then(() => kv.expire(totalKey, CLICK_TTL_S)),
    ]);
  }

  return NextResponse.redirect(target.toString(), {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  });
}
