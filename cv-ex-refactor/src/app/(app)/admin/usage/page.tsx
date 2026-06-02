import type { Metadata } from 'next';
import { currentYm, getUsageSnapshot, type UserUsageRow } from '@/lib/usage/read-usage';
import { getJobFitStats } from '@/lib/usage/read-job-fit-stats';
import { microUsdToString } from '@/lib/llm/model-prices';
import { JobFitStatsSection } from './job-fit-stats-section';
import { vnDateString } from '@/lib/quota/vn-date';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  const jobFitStats = await getJobFitStats(todayYmd);

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
                <Th align="right">Extract ok / err</Th>
                <Th align="right">Tokens</Th>
                <Th align="right">Shared cost</Th>
              </tr>
            </thead>
            <tbody>
              {snapshot.daily.map((d) => (
                <tr key={d.date} className="border-t border-outline-variant">
                  <Td>{d.date}</Td>
                  <Td align="right">
                    {fmt(d.analyzeOk)} / {fmt(d.analyzeError)}
                  </Td>
                  <Td align="right">
                    {fmt(d.generateCvOk)} / {fmt(d.generateCvError)}
                  </Td>
                  <Td align="right">
                    {fmt(d.extractMustHavesOk)} / {fmt(d.extractMustHavesError)}
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
