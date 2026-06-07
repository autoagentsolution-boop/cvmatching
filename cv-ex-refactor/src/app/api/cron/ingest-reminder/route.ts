// Vercel cron handler — 3-day nudge to admin to run `pnpm seed-pool` locally.
//
// Why this exists instead of a CI scraper: Cloudflare blocks GH Actions ASN
// for VN-customer sites (topcv.vn, itviec.com) regardless of curl-impersonate
// TLS variant — confirmed 2026-06-07. Admin's Bangkok-region IP passes CF,
// so we keep ingest local-manual and use this cron as the reminder.
// See: plans/reports/researcher-260607-1648-cf-bypass-ci-2026-sota.md
//
// Schedule: 0 19 *\/3 * * = 19:00 UTC every 3rd day = 02:00 ICT next day.
// Alerts via ALERT_WEBHOOK_URL (same env var used by cost-guard + pool-low).
// Pushover-shaped URL is detected and routed accordingly.

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { count, max, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { jobs } from '@/db/schema';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1'; // Neon proximity (SG → SG)
export const maxDuration = 30;

const OVERDUE_DAYS = 4; // > 3-day cadence → escalate priority

function errJson(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

interface PoolSnapshot {
  activeCount: number;
  daysSinceLastIngest: number | null;
  lastIngestIso: string | null;
}

async function readPoolSnapshot(): Promise<PoolSnapshot> {
  const db = getDb();
  const [activeRow, lastRow] = await Promise.all([
    db.select({ n: count() }).from(jobs).where(eq(jobs.active, true)),
    db.select({ last: max(jobs.createdAt) }).from(jobs),
  ]);
  const activeCount = Number(activeRow[0]?.n ?? 0);
  const lastDate = lastRow[0]?.last ?? null;
  const daysSinceLastIngest = lastDate
    ? Math.floor((Date.now() - lastDate.getTime()) / 86_400_000)
    : null;
  return {
    activeCount,
    daysSinceLastIngest,
    lastIngestIso: lastDate ? lastDate.toISOString() : null,
  };
}

function buildMessage(snap: PoolSnapshot): { title: string; text: string; priority: 0 | 1 } {
  const overdue = snap.daysSinceLastIngest !== null && snap.daysSinceLastIngest >= OVERDUE_DAYS;
  const sinceText =
    snap.daysSinceLastIngest === null
      ? 'never'
      : `${snap.daysSinceLastIngest}d ago`;
  const title = overdue
    ? `[CV-Ex] Ingest OVERDUE (${sinceText})`
    : `[CV-Ex] Ingest reminder`;
  const text =
    `Run \`pnpm seed-pool\` locally to refresh the pool.\n` +
    `Last ingest: ${sinceText}\n` +
    `Active jobs: ${snap.activeCount}`;
  return { title, text, priority: overdue ? 1 : 0 };
}

// Pushover-aware fire. Mirrors the adapter in src/lib/cost/guard.ts —
// kept inline for now (3rd duplication). If a 4th use lands, extract to
// src/lib/alerting/send-alert.ts and refactor the three existing callsites.
async function fireAlert(
  url: string,
  msg: { title: string; text: string; priority: 0 | 1 },
): Promise<{ ok: boolean; status: number; channel: string }> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 5_000);
  try {
    if (/api\.pushover\.net/.test(url)) {
      const parsed = new URL(url);
      const token = parsed.searchParams.get('token');
      const user = parsed.searchParams.get('user');
      if (!token || !user) {
        return { ok: false, status: 0, channel: 'pushover' };
      }
      const cleanUrl = `${parsed.origin}${parsed.pathname}`;
      const res = await fetch(cleanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          user,
          title: msg.title,
          message: msg.text,
          priority: msg.priority,
        }),
        signal: controller.signal,
      });
      return { ok: res.ok, status: res.status, channel: 'pushover' };
    }

    // Generic JSON webhook (Slack / Discord / Zapier shape)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'cv-ex-ingest-reminder',
        severity: msg.priority === 1 ? 'warning' : 'info',
        title: msg.title,
        text: msg.text,
      }),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, channel: 'webhook' };
  } finally {
    clearTimeout(tid);
  }
}

export async function GET(req: NextRequest) {
  // Bearer auth — Vercel injects Authorization: Bearer $CRON_SECRET for cron routes.
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

  const webhookUrl = env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return errJson('not_configured', 'ALERT_WEBHOOK_URL is not set.', 503);
  }

  let snap: PoolSnapshot;
  try {
    snap = await readPoolSnapshot();
  } catch (e) {
    console.error('[ingest-reminder] db_read_failed', e);
    return errJson('db_error', 'Failed to read pool snapshot from Postgres.', 500);
  }

  const msg = buildMessage(snap);
  const result = await fireAlert(webhookUrl, msg).catch((e) => {
    console.warn('[ingest-reminder] alert_fire_failed', e);
    return { ok: false, status: 0, channel: 'unknown' };
  });

  return NextResponse.json({
    ok: result.ok,
    snapshot: snap,
    alert: result,
  });
}
