// Vercel cron handler — refreshes job liveness by HEAD-checking sourceUrls.
// Schedule: 0 20 * * * (20:00 UTC = 03:00 ICT) — single daily tick, Vercel Pro maxDuration 300s.
// Authorization: Vercel injects Authorization: Bearer <CRON_SECRET> automatically.

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { env } from '@/lib/env';
import { vnDateString } from '@/lib/quota/vn-date';
// Postgres-backed since pre-2K hardening. Previously KV-backed → would have
// skipped HEAD-checks on every PG-ingested job after Phase 4 cutover.
// `refresh:cursor` + `metrics:refresh:*` stats keys stay on KV — they're
// metadata, not job data.
import { listActiveIds, getJob, expireJob } from '@/lib/jobs/repo-postgres';
import { refreshBatch } from '@/lib/jobs/refresh-batch';

export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Pro tier

const UA = 'ResumeRefineRefreshBot/1.0';
const TIMEOUT_MS = 5_000;
const SLEEP_MS = 1_500;
const JITTER_MS = 500;
const DEADLINE_BUFFER_MS = 30_000; // stop 30s before maxDuration
const POOL_LOW_THRESHOLD = 50;
const VERIFIED_AT_MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000; // 21 days

function errJson(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function firePoolLowAlert(activeCount: number, expiredCount: number): Promise<void> {
  const url = env.ALERT_WEBHOOK_URL;
  if (!url) return;
  const payload = {
    type: 'cv-ex-job-pool-low',
    severity: 'warning',
    text: `:warning: Job pool low: ${activeCount - expiredCount} active after refresh (threshold: ${POOL_LOW_THRESHOLD})`,
    activeCount,
    expiredThisTick: expiredCount,
  };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fire-and-forget; do not block response on webhook failure
  }
}

export async function GET(req: NextRequest) {
  // Bearer auth — Vercel injects the header automatically for cron routes.
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = env.CRON_SECRET;

  // P2.1 — constant-time compare to avoid timing-based secret deduction
  const expected = `Bearer ${cronSecret}`;
  const authorized =
    !!cronSecret &&
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  if (!authorized) {
    return errJson('unauthorized', 'Invalid or missing Authorization header.', 401);
  }

  if (!kvAvailable) {
    return errJson('service_unavailable', 'KV not configured.', 503);
  }

  const startedAt = Date.now();
  const deadlineMs = startedAt + maxDuration * 1000 - DEADLINE_BUFFER_MS;
  const ymd = vnDateString();

  // Read cursor (resume point from previous tick, if deadline was hit)
  const cursorRaw = await kv.get<string | number>('refresh:cursor');
  const cursor = typeof cursorRaw === 'number' ? cursorRaw : Number(cursorRaw ?? 0);

  const activeIds = await listActiveIds();

  // Auto-expire sweep: move jobs with verifiedAt > 21d regardless of HEAD result.
  // P1.2 — deadline-guarded; break early if we're running low on budget.
  let autoExpired = 0;
  const autoExpiredIds = new Set<string>();
  const now = Date.now();
  for (const id of activeIds) {
    if (Date.now() >= deadlineMs) break; // P1.2: budget guard
    try {
      const job = await getJob(id);
      if (!job) continue;
      const age = now - new Date(job.verifiedAt).getTime();
      if (age > VERIFIED_AT_MAX_AGE_MS) {
        await expireJob(id);
        autoExpired++;
        autoExpiredIds.add(id); // P2.7: track to avoid double-count in batch
      }
    } catch {
      // Skip individual failures — don't block sweep
    }
  }

  // Batch starting from cursor — exclude already-auto-expired ids (P2.7: avoid double-count)
  const batchIds = activeIds.slice(cursor).filter((id) => !autoExpiredIds.has(id));
  const { ok, expired, errors, lastIndex } = await refreshBatch(batchIds, {
    ua: UA,
    timeoutMs: TIMEOUT_MS,
    sleepMs: SLEEP_MS,
    jitterMs: JITTER_MS,
    deadlineMs,
  });

  // Advance cursor (wrap to 0 when we've processed all)
  const absoluteLastIndex = cursor + lastIndex;
  const nextCursor =
    lastIndex === -1 || absoluteLastIndex >= activeIds.length - 1
      ? 0
      : absoluteLastIndex + 1;
  await kv.set('refresh:cursor', nextCursor);

  // Write stats hash.
  // P1.3 — expire AFTER writes complete; parallel expire races against key creation.
  const statsKey = `metrics:refresh:${ymd}`;
  await Promise.all([
    kv.hincrby(statsKey, 'ok', ok),
    kv.hincrby(statsKey, 'expired', expired + autoExpired),
    kv.hincrby(statsKey, 'errors', errors),
    kv.hincrby(statsKey, 'batches', 1),
  ]);
  await kv.expire(statsKey, 86400 * 2);

  // Pool-low alert
  const remainingActive = activeIds.length - expired - autoExpired;
  if (remainingActive < POOL_LOW_THRESHOLD) {
    await firePoolLowAlert(activeIds.length, expired + autoExpired);
  }

  return NextResponse.json({
    ok,
    expired: expired + autoExpired,
    errors,
    batchSize: batchIds.length,
    cursor: nextCursor,
    activePoolBefore: activeIds.length,
    elapsedMs: Date.now() - startedAt,
  });
}
