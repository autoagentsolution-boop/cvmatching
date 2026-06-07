import type { Metadata } from 'next';
import { currentYm, getUsageSnapshot, type UserUsageRow } from '@/lib/usage/read-usage';
import { getJobFitStats } from '@/lib/usage/read-job-fit-stats';
import { microUsdToString } from '@/lib/llm/model-prices';
import { JobFitStatsSection } from './job-fit-stats-section';
import { vnDateString } from '@/lib/quota/vn-date';
import { readVisitStats, readDailyVisits } from '@/lib/analytics/visit-counter';
import { readBucketStatus, isAlertWebhookConfigured, WARN_LIMIT_MICRO_USD, KILL_LIMIT_MICRO_USD } from '@/lib/cost/guard';
import { COST_BUCKETS } from '@/lib/cost/buckets';
import { readActivationDay, ACTIVATION_ACTIONS, type ActivationAction } from '@/lib/usage/read-activation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Pin to Singapore — heavy KV fan-out for usage rollups; cross-region
// RTT (default US-East) would amplify each call.
export const preferredRegion = 'sin1';

export const metadata: Metadata = {
  title: 'Usage — Admin',
  robots: { index: false, follow: false },
};

interface SearchParams {
  month?: string;
  days?: string;
}

function parseMonth(input: string | undefined): string {
  if (!input) return currentYm();
  if (/^\d{4}-\d{2}$/.test(input)) return input;
  return currentYm();
}

function parseDays(input: string | undefined): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(90, Math.floor(n));
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtChars(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const month = parseMonth(sp.month);
  const days = parseDays(sp.days);

  const snapshot = await getUsageSnapshot(month, days);
  const todayYmd = vnDateString();
  const [jobFitStats, visitStats, dailyVisits, bucketStatus, activationToday] = await Promise.all([
    getJobFitStats(todayYmd),
    readVisitStats(),
    readDailyVisits(days),
    readBucketStatus(COST_BUCKETS, todayYmd),
    readActivationDay(todayYmd),
  ]);
  const webhookConfigured = isAlertWebhookConfigured();
  const totalShardSpendToday = bucketStatus.reduce((a, b) => a + b.cumulativeMicroUsd, 0);
  const anyKilled = bucketStatus.some((b) => b.killed);

  // Today's per-action submit counts — funnel terminal nodes for Q4.
  const todayRow = snapshot.daily.find((d) => d.date === todayYmd);
  const todayAnalyzeOk = todayRow?.analyzeOk ?? 0;
  const todayGenCvOk = todayRow?.generateCvOk ?? 0;
  const todayJobFitOk = todayRow?.jobRecommendOk ?? 0;
  const todayCareerOk = (todayRow?.careerPathOk ?? 0) + (todayRow?.careerPathSuggestOk ?? 0);

  // Drop-off rates against pageviews (cap at 100% for tiny denominators).
  const pct = (numer: number): string => {
    if (!visitStats.today) return '—';
    return `${Math.min(100, (numer / visitStats.today) * 100).toFixed(1)}%`;
  };

  const totalUsers = snapshot.users.length;
  const totalCalls = snapshot.users.reduce(
    (acc, u) => acc + u.analyze + u.generateCv + u.extractMustHaves,
    0,
  );
  const totalShared = snapshot.users.reduce((acc, u) => acc + u.shared, 0);
  const totalByok = snapshot.users.reduce((acc, u) => acc + u.byok, 0);
  const totalTokens = snapshot.users.reduce((acc, u) => acc + u.tokens, 0);
  const totalCost = snapshot.users.reduce((acc, u) => acc + u.costMicroUsd, 0);

  const dailyTotals = snapshot.daily.reduce(
    (acc, d) => ({
      ok: acc.ok + d.analyzeOk + d.generateCvOk + d.extractMustHavesOk,
      err: acc.err + d.analyzeError + d.generateCvError + d.extractMustHavesError,
      tokens: acc.tokens + d.tokens,
      sharedCalls: acc.sharedCalls + d.sharedCalls,
      sharedCost: acc.sharedCost + d.sharedCostMicroUsd,
    }),
    { ok: 0, err: 0, tokens: 0, sharedCalls: 0, sharedCost: 0 },
  );

  const exportUrl = `/api/admin/export-usage?month=${month}`;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="font-display text-display-sm font-bold text-primary">Usage</h1>
        <p className="text-label-md text-on-surface-variant">
          Month: <strong>{month}</strong> · Daily window: <strong>{days}</strong> days · Active users:{' '}
          <strong>{totalUsers}</strong>
        </p>
        <form className="mt-3 flex flex-wrap items-center gap-2 text-label-sm">
          <input
            name="month"
            defaultValue={month}
            placeholder="YYYY-MM"
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5"
          />
          <input
            name="days"
            defaultValue={days}
            placeholder="30"
            className="w-20 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-3 py-1.5 text-on-primary font-medium"
          >
            Reload
          </button>
          <a
            href={exportUrl}
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-on-surface hover:bg-surface-container-high"
          >
            Export CSV
          </a>
        </form>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total calls (month)" value={fmt(totalCalls)} />
        <Stat label="Shared / BYOK" value={`${fmt(totalShared)} / ${fmt(totalByok)}`} />
        <Stat label="Tokens (month)" value={fmtChars(totalTokens)} />
        <Stat label="Cost (month)" value={microUsdToString(totalCost)} />
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-3 font-display text-headline-sm font-bold text-on-surface">
          Cost kill-switch — today ({todayYmd})
          {!webhookConfigured && (
            <span className="rounded-md bg-error/15 px-2 py-0.5 text-label-sm text-error">
              ⚠ ALERT_WEBHOOK_URL not configured — alerts silent
            </span>
          )}
          {anyKilled && (
            <span className="rounded-md bg-error/15 px-2 py-0.5 text-label-sm text-error">
              🛑 One or more buckets killed
            </span>
          )}
        </h2>
        <p className="mb-2 text-label-sm text-on-surface-variant">
          Per-bucket daily spend (shared-key only — BYOK excluded). WARN at{' '}
          {microUsdToString(WARN_LIMIT_MICRO_USD)}, KILL at{' '}
          {microUsdToString(KILL_LIMIT_MICRO_USD)}. Total today:{' '}
          <strong>{microUsdToString(totalShardSpendToday)}</strong> ({COST_BUCKETS.length} buckets × $3 cap = $
          {COST_BUCKETS.length * 3}/day ceiling).
        </p>
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-label-sm">
            <thead className="bg-surface-container-low text-on-surface-variant">
              <tr>
                <Th>Bucket</Th>
                <Th align="right">Today spend</Th>
                <Th align="right">% of KILL</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {bucketStatus.map((b) => {
                const pctKill = (b.cumulativeMicroUsd / KILL_LIMIT_MICRO_USD) * 100;
                const status = b.killed
                  ? '🛑 KILLED'
                  : b.cumulativeMicroUsd >= WARN_LIMIT_MICRO_USD
                    ? '⚠ WARN'
                    : 'ok';
                return (
                  <tr key={b.bucket} className="border-t border-outline-variant">
                    <Td>
                      <code>{b.bucket}</code>
                    </Td>
                    <Td align="right">{microUsdToString(b.cumulativeMicroUsd)}</Td>
                    <Td align="right">{pctKill.toFixed(1)}%</Td>
                    <Td align="right">{status}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm font-bold text-on-surface">
          Visit funnel — today ({todayYmd})
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Pageviews" value={fmt(visitStats.today)} />
          <Stat label="Unique users (IP)" value={fmt(visitStats.todayUnique)} />
          <Stat label="Signed-in pageviews" value={`${fmt(visitStats.todayAuthed)} (${pct(visitStats.todayAuthed)})`} />
          <Stat label="Lifetime PV / unique" value={`${fmtChars(visitStats.total)} / ${fmtChars(visitStats.totalUnique)}`} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Analyze submits" value={`${fmt(todayAnalyzeOk)} (${pct(todayAnalyzeOk)})`} />
          <Stat label="Refine CV submits" value={`${fmt(todayGenCvOk)} (${pct(todayGenCvOk)})`} />
          <Stat label="Fit Job submits" value={`${fmt(todayJobFitOk)} (${pct(todayJobFitOk)})`} />
          <Stat label="Career Path submits" value={`${fmt(todayCareerOk)} (${pct(todayCareerOk)})`} />
        </div>
        <p className="mt-2 text-label-sm text-on-surface-variant">
          % bằng action / pageviews hôm nay. Pageview = mỗi page navigation (matcher proxy.ts loại
          /api, /_next, prefetch). Unique = số IP riêng biệt trong ngày. Signed-in = pageviews có JWT
          NextAuth hợp lệ.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm font-bold text-on-surface">
          Activation today — anon vs signed-in
        </h2>
        <p className="mb-2 text-label-sm text-on-surface-variant">
          Successful submits per feature, split by shared-key anonymous vs signed-in.
          Conversion = signed-in / total. Anon-only counter started{' '}
          <strong>2026-06-06</strong> — earlier traffic shows as 100% signed-in (clamped).
          analyze-v2 = JD Matching page, analyze-v3 = CV-Solo /analyze.
        </p>
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-label-sm">
            <thead className="bg-surface-container-low text-on-surface-variant">
              <tr>
                <Th>Feature</Th>
                <Th align="right">Total ok</Th>
                <Th align="right">Anon</Th>
                <Th align="right">Signed-in</Th>
                <Th align="right">Conversion</Th>
              </tr>
            </thead>
            <tbody>
              {ACTIVATION_ACTIONS.map((action: ActivationAction) => {
                const c = activationToday.features[action];
                const conversion =
                  c.total > 0 ? `${((c.signedIn / c.total) * 100).toFixed(1)}%` : '—';
                return (
                  <tr key={action} className="border-t border-outline-variant">
                    <Td>
                      <code>{action}</code>
                    </Td>
                    <Td align="right">{fmt(c.total)}</Td>
                    <Td align="right">{fmt(c.anon)}</Td>
                    <Td align="right">{fmt(c.signedIn)}</Td>
                    <Td align="right">{conversion}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm font-bold text-on-surface">
          Visit history — last {days} days
        </h2>
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-label-sm">
            <thead className="bg-surface-container-low text-on-surface-variant">
              <tr>
                <Th>Date</Th>
                <Th align="right">Pageviews</Th>
                <Th align="right">Unique IPs</Th>
                <Th align="right">Signed-in</Th>
                <Th align="right">Auth rate</Th>
              </tr>
            </thead>
            <tbody>
              {[...dailyVisits].reverse().map((v) => (
                <tr key={v.date} className="border-t border-outline-variant">
                  <Td>{v.date}</Td>
                  <Td align="right">{fmt(v.pageviews)}</Td>
                  <Td align="right">{fmt(v.unique)}</Td>
                  <Td align="right">{fmt(v.authed)}</Td>
                  <Td align="right">
                    {v.pageviews > 0
                      ? `${((v.authed / v.pageviews) * 100).toFixed(1)}%`
                      : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-label-sm text-on-surface-variant">
          Lịch sử 90 ngày (TTL keys). Trước 2026-06-03 không có cột Signed-in (mới track từ commit
          add-auth-rate).
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm font-bold text-on-surface">
          Per-user usage — {month}
        </h2>
        {snapshot.users.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No signed-in usage recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline-variant">
            <table className="w-full text-label-sm">
              <thead className="bg-surface-container-low text-on-surface-variant">
                <tr>
                  <Th>User ID</Th>
                  <Th align="right">Analyze</Th>
                  <Th align="right">Gen CV</Th>
                  <Th align="right">Extract</Th>
                  <Th align="right">Shared</Th>
                  <Th align="right">BYOK</Th>
                  <Th align="right">Tokens</Th>
                  <Th align="right">Cost</Th>
                </tr>
              </thead>
              <tbody>
                {snapshot.users.map((u) => (
                  <UserRow key={u.userId} u={u} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-label-sm text-on-surface-variant">
          BYOK without sign-in (anonymous, this month): analyze={snapshot.byokAnon.analyze},
          generate-cv={snapshot.byokAnon.generateCv}, extract-must-haves=
          {snapshot.byokAnon.extractMustHaves}
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm font-bold text-on-surface">
          Daily volume — last {days} days
        </h2>
        <p className="mb-2 text-label-sm text-on-surface-variant">
          Totals: {fmt(dailyTotals.ok)} ok · {fmt(dailyTotals.err)} errors ·{' '}
          {fmtChars(dailyTotals.tokens)} tokens · shared-key {fmt(dailyTotals.sharedCalls)} calls ·{' '}
          {microUsdToString(dailyTotals.sharedCost)} spend
        </p>
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-label-sm">
            <thead className="bg-surface-container-low text-on-surface-variant">
              <tr>
                <Th>Date</Th>
                <Th align="right">Analyze ok / err</Th>
                <Th align="right">Gen CV ok / err</Th>
                <Th align="right">Cover Ltr ok / err</Th>
                <Th align="right">Extract ok / err</Th>
                <Th align="right">Fit Job ok / err</Th>
                <Th align="right">Career ok / err</Th>
                <Th align="right">Tokens</Th>
                <Th align="right">Shared cost</Th>
              </tr>
            </thead>
            <tbody>
              {[...snapshot.daily].reverse().map((d) => (
                <tr key={d.date} className="border-t border-outline-variant">
                  <Td>{d.date}</Td>
                  <Td align="right">
                    {fmt(d.analyzeOk)} / {fmt(d.analyzeError)}
                  </Td>
                  <Td align="right">
                    {fmt(d.generateCvOk)} / {fmt(d.generateCvError)}
                  </Td>
                  <Td align="right">
                    {fmt(d.generateCoverLetterOk)} / {fmt(d.generateCoverLetterError)}
                  </Td>
                  <Td align="right">
                    {fmt(d.extractMustHavesOk)} / {fmt(d.extractMustHavesError)}
                  </Td>
                  <Td align="right">
                    {fmt(d.jobRecommendOk)} / {fmt(d.jobRecommendError)}
                  </Td>
                  <Td align="right">
                    {fmt(d.careerPathOk + d.careerPathSuggestOk)} /{' '}
                    {fmt(d.careerPathError + d.careerPathSuggestError)}
                  </Td>
                  <Td align="right">{fmtChars(d.tokens)}</Td>
                  <Td align="right">{microUsdToString(d.sharedCostMicroUsd)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <JobFitStatsSection stats={jobFitStats} ymd={todayYmd} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="font-display text-headline-sm font-bold text-on-surface">{value}</p>
    </div>
  );
}

function UserRow({ u }: { u: UserUsageRow }) {
  return (
    <tr className="border-t border-outline-variant">
      <Td>
        <code className="text-label-sm">{u.userId}</code>
      </Td>
      <Td align="right">{fmt(u.analyze)}</Td>
      <Td align="right">{fmt(u.generateCv)}</Td>
      <Td align="right">{fmt(u.extractMustHaves)}</Td>
      <Td align="right">{fmt(u.shared)}</Td>
      <Td align="right">{fmt(u.byok)}</Td>
      <Td align="right">{fmtChars(u.tokens)}</Td>
      <Td align="right">{microUsdToString(u.costMicroUsd)}</Td>
    </tr>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <td className={`px-3 py-2 ${align === 'right' ? 'text-right tabular-nums' : ''}`}>
      {children}
    </td>
  );
}
