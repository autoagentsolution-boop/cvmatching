import type { Metadata } from 'next';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { jobs } from '@/db/schema';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { env } from '@/lib/env';
import { PoolTriggerButton } from './pool-trigger-button';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Pin to Singapore for Neon Postgres proximity. Default Vercel region is
// US-East — every SQL query incurs ~200-300ms cross-region RTT, multiplied
// by the 5 queries this page runs (would be ~1-1.5s extra without pin).
export const preferredRegion = 'sin1';

export const metadata: Metadata = {
  title: 'Job pool — Admin',
  robots: { index: false, follow: false },
};

interface VerticalRow {
  vertical: string;
  active: number;
  inactive: number;
}

interface RecentJobRow {
  id: string;
  title: string;
  company: string;
  vertical: string;
  source: string;
  postedAt: Date;
  verifiedAt: Date;
}

async function fetchPoolStats(): Promise<{
  totalActive: number;
  totalInactive: number;
  byVertical: VerticalRow[];
  bySource: Array<{ source: string; active: number }>;
  bySeniority: Array<{ seniority: string; active: number }>;
  freshness: { p50AgeDays: number; p95AgeDays: number; oldestActiveDays: number };
  recent: RecentJobRow[];
}> {
  const db = getDb();

  // All 5 queries are independent — fan out in parallel. Sequential await
  // was 5×RTT (~500ms on sin1, 1-1.5s if cross-region); parallel is 1×RTT.
  const [verticalRows, sourceRows, seniorityRows, freshnessRows, recentRows] = await Promise.all([
    db.execute<{ vertical: string; active: string; inactive: string }>(sql`
      SELECT
        vertical,
        COUNT(*) FILTER (WHERE active = true) AS active,
        COUNT(*) FILTER (WHERE active = false) AS inactive
      FROM ${jobs}
      GROUP BY vertical
      ORDER BY active DESC
    `),
    db.execute<{ source: string; active: string }>(sql`
      SELECT source, COUNT(*) AS active
      FROM ${jobs}
      WHERE active = true
      GROUP BY source
      ORDER BY active DESC
    `),
    db.execute<{ seniority: string; active: string }>(sql`
      SELECT seniority, COUNT(*) AS active
      FROM ${jobs}
      WHERE active = true
      GROUP BY seniority
      ORDER BY active DESC
    `),
    db.execute<{ p50_days: string; p95_days: string; oldest_days: string }>(sql`
      SELECT
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM now() - posted_at) / 86400), 0) AS p50_days,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM now() - posted_at) / 86400), 0) AS p95_days,
        COALESCE(MAX(EXTRACT(EPOCH FROM now() - posted_at) / 86400), 0) AS oldest_days
      FROM ${jobs}
      WHERE active = true
    `),
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        vertical: jobs.vertical,
        source: jobs.source,
        postedAt: jobs.postedAt,
        verifiedAt: jobs.verifiedAt,
      })
      .from(jobs)
      .where(sql`${jobs.active} = true`)
      .orderBy(sql`${jobs.verifiedAt} DESC`)
      .limit(10),
  ]);

  const byVertical = (verticalRows.rows ?? verticalRows).map((r) => ({
    vertical: r.vertical,
    active: Number(r.active),
    inactive: Number(r.inactive),
  })) as VerticalRow[];

  const totalActive = byVertical.reduce((acc, r) => acc + r.active, 0);
  const totalInactive = byVertical.reduce((acc, r) => acc + r.inactive, 0);

  const bySource = ((sourceRows.rows ?? sourceRows) as { source: string; active: string }[]).map((r) => ({
    source: r.source,
    active: Number(r.active),
  }));

  const bySeniority = ((seniorityRows.rows ?? seniorityRows) as { seniority: string; active: string }[]).map((r) => ({
    seniority: r.seniority,
    active: Number(r.active),
  }));

  const freshRow = (freshnessRows.rows ?? freshnessRows)[0] as {
    p50_days?: string;
    p95_days?: string;
    oldest_days?: string;
  } | undefined;
  const freshness = {
    p50AgeDays: Number(freshRow?.p50_days ?? 0),
    p95AgeDays: Number(freshRow?.p95_days ?? 0),
    oldestActiveDays: Number(freshRow?.oldest_days ?? 0),
  };

  return { totalActive, totalInactive, byVertical, bySource, bySeniority, freshness, recent: recentRows };
}

async function fetchLastTriggerInfo(): Promise<{ lastDispatchedAt?: string; lastTriggeredBy?: string }> {
  if (!kvAvailable) return {};
  try {
    const meta = await kv.get<{ dispatchedAt: string; user: string }>('admin:pool:last-dispatch');
    if (!meta) return {};
    return { lastDispatchedAt: meta.dispatchedAt, lastTriggeredBy: meta.user };
  } catch {
    return {};
  }
}

function formatAge(days: number): string {
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${days.toFixed(1)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}

function relativeFromNow(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export default async function AdminPoolPage() {
  const [stats, lastTrigger] = await Promise.all([fetchPoolStats(), fetchLastTriggerInfo()]);
  const triggerConfigured =
    !!env.GITHUB_DISPATCH_TOKEN && !!(env.GITHUB_REPO ?? 'autoagentsolution-boop/cvmatching');
  const ghActionsUrl = `https://github.com/${env.GITHUB_REPO ?? 'autoagentsolution-boop/cvmatching'}/actions/workflows/refresh-jobs.yml`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-display-sm font-bold text-primary">Job pool</h1>
        <p className="text-label-md text-on-surface-variant">
          Trạng thái pool jobs hiện tại + nút trigger refresh qua GitHub Actions.
        </p>
      </header>

      {/* Top summary cards */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="text-label-md text-on-surface-variant">Active</div>
          <div className="font-display text-headline-md font-bold text-on-surface">
            {stats.totalActive.toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="text-label-md text-on-surface-variant">Inactive</div>
          <div className="font-display text-headline-md font-bold text-on-surface">
            {stats.totalInactive.toLocaleString('vi-VN')}
          </div>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="text-label-md text-on-surface-variant">Median age</div>
          <div className="font-display text-headline-md font-bold text-on-surface">
            {formatAge(stats.freshness.p50AgeDays)}
          </div>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="text-label-md text-on-surface-variant">P95 age</div>
          <div className="font-display text-headline-md font-bold text-on-surface">
            {formatAge(stats.freshness.p95AgeDays)}
          </div>
        </div>
      </section>

      {/* Trigger */}
      <section className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-headline-sm font-bold text-on-surface">Refresh</h2>
          <a
            href={ghActionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label-md text-primary underline"
          >
            Xem GH runs ↗
          </a>
        </div>

        {!triggerConfigured ? (
          <div className="rounded-lg bg-error-container p-3 text-body-sm text-on-error-container">
            <strong>Chưa setup.</strong> Cần env <code>GITHUB_DISPATCH_TOKEN</code> trên Vercel.
            Trong lúc đó: chạy <code>pnpm run seed-pool</code> local.
          </div>
        ) : (
          <PoolTriggerButton />
        )}

        {lastTrigger.lastDispatchedAt && (
          <p className="text-label-md text-on-surface-variant">
            Trigger gần nhất từ UI: {relativeFromNow(new Date(lastTrigger.lastDispatchedAt))}
            {lastTrigger.lastTriggeredBy ? ` · ${lastTrigger.lastTriggeredBy}` : ''}
          </p>
        )}
      </section>

      {/* Per-vertical breakdown */}
      <section className="space-y-2">
        <h2 className="font-display text-headline-sm font-bold text-on-surface">Phân bố vertical</h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant">
          <table className="w-full text-body-md">
            <thead className="bg-surface-container-low text-label-md text-on-surface-variant">
              <tr>
                <th className="px-4 py-2 text-left">Vertical</th>
                <th className="px-4 py-2 text-right">Active</th>
                <th className="px-4 py-2 text-right">Inactive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {stats.byVertical.map((r) => (
                <tr key={r.vertical}>
                  <td className="px-4 py-2 font-medium text-on-surface">{r.vertical}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.active.toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-on-surface-variant">
                    {r.inactive.toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Source + seniority side-by-side */}
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 font-display text-headline-sm font-bold text-on-surface">Nguồn</h2>
          <div className="overflow-hidden rounded-xl border border-outline-variant">
            <table className="w-full text-body-md">
              <tbody className="divide-y divide-outline-variant">
                {stats.bySource.map((r) => (
                  <tr key={r.source}>
                    <td className="px-4 py-2 text-on-surface">{r.source}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.active.toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="mb-2 font-display text-headline-sm font-bold text-on-surface">Seniority</h2>
          <div className="overflow-hidden rounded-xl border border-outline-variant">
            <table className="w-full text-body-md">
              <tbody className="divide-y divide-outline-variant">
                {stats.bySeniority.map((r) => (
                  <tr key={r.seniority}>
                    <td className="px-4 py-2 text-on-surface">{r.seniority}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.active.toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Recent ingest */}
      <section className="space-y-2">
        <h2 className="font-display text-headline-sm font-bold text-on-surface">10 jobs verified gần nhất</h2>
        <div className="overflow-hidden rounded-xl border border-outline-variant">
          <table className="w-full text-body-sm">
            <thead className="bg-surface-container-low text-label-md text-on-surface-variant">
              <tr>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Company</th>
                <th className="px-4 py-2 text-left">Vertical</th>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-right">Posted</th>
                <th className="px-4 py-2 text-right">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {stats.recent.map((j) => (
                <tr key={j.id}>
                  <td className="px-4 py-2 text-on-surface">{j.title}</td>
                  <td className="px-4 py-2 text-on-surface-variant">{j.company}</td>
                  <td className="px-4 py-2 text-on-surface-variant">{j.vertical}</td>
                  <td className="px-4 py-2 text-on-surface-variant">{j.source}</td>
                  <td className="px-4 py-2 text-right text-on-surface-variant">
                    {relativeFromNow(new Date(j.postedAt))}
                  </td>
                  <td className="px-4 py-2 text-right text-on-surface-variant">
                    {relativeFromNow(new Date(j.verifiedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
