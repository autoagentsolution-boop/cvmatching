// GET /api/cron/interview-abandon — daily sweep flipping >24h in_progress
// sessions to abandoned. Vercel cron entry lives in vercel.ts.
//
// Vercel cron uses GET + Authorization: Bearer $CRON_SECRET. The sweep is
// idempotent — running it twice in a row just no-ops the second call.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { markAbandoned } from '@/lib/interview/storage';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';

const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

function errJson(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = env.CRON_SECRET;
  const expected = `Bearer ${cronSecret}`;
  const authorized =
    !!cronSecret &&
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  if (!authorized) {
    return errJson('unauthorized', 'Invalid or missing Authorization header.', 401);
  }

  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS);
  try {
    const updated = await markAbandoned(cutoff);
    return NextResponse.json({ ok: true, updated, cutoff: cutoff.toISOString() });
  } catch (e) {
    console.error('[cron/interview-abandon] sweep_failed', e);
    return errJson('db_error', 'Failed to run abandon sweep.', 500);
  }
}
