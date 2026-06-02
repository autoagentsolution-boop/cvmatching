// Server component — renders the "Job Fit & Study" section on the admin usage page.
// Pulled into its own file so admin/usage/page.tsx stays under 200 LOC.

import { microUsdToString } from '@/lib/llm/model-prices';
import type { JobFitStats } from '@/lib/usage/read-job-fit-stats';

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="font-display text-headline-sm font-bold text-on-surface">{value}</p>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
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

export function JobFitStatsSection({ stats, ymd }: { stats: JobFitStats; ymd: string }) {
  return (
    <section className="space-y-6">
      <h2 className="font-display text-headline-sm font-bold text-on-surface">
        Job Fit &amp; Study — {ymd}
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Recommend cost (today)" value={stats.jobRecommend.costDisplay} />
        <Stat label="Total clicks (today)" value={fmt(stats.clicks.total)} />
        <Stat label="Refresh ok / expired" value={`${fmt(stats.refresh.ok)} / ${fmt(stats.refresh.expired)}`} />
        <Stat label="Refresh errors" value={fmt(stats.refresh.errors)} />
      </div>

      {/* Top-10 clicked jobs */}
      <div>
        <h3 className="mb-2 text-label-md font-semibold text-on-surface">
          Top clicked jobs today
        </h3>
        {stats.clicks.top10.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">No click data yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline-variant">
            <table className="w-full text-label-sm">
              <thead className="bg-surface-container-low text-on-surface-variant">
                <tr>
                  <Th>Job ID</Th>
                  <Th align="right">Clicks</Th>
                </tr>
              </thead>
              <tbody>
                {stats.clicks.top10.map((entry) => (
                  <tr key={entry.jobId} className="border-t border-outline-variant">
                    <Td>
                      <code className="text-label-sm">{entry.jobId}</code>
                    </Td>
                    <Td align="right">{fmt(entry.count)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top-disliked topics */}
      <div>
        <h3 className="mb-2 text-label-md font-semibold text-on-surface">
          Top disliked topics (this week)
        </h3>
        {stats.topDislikedTopics.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">No dislike data yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline-variant">
            <table className="w-full text-label-sm">
              <thead className="bg-surface-container-low text-on-surface-variant">
                <tr>
                  <Th>Topic ID</Th>
                  <Th align="right">Dislikes</Th>
                </tr>
              </thead>
              <tbody>
                {stats.topDislikedTopics.map((t) => (
                  <tr key={t.topicId} className="border-t border-outline-variant">
                    <Td>{t.topicId}</Td>
                    <Td align="right">{fmt(t.count)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refresh detail */}
      <p className="text-label-sm text-on-surface-variant">
        Refresh batches today: <strong>{fmt(stats.refresh.batches)}</strong> ·
        Cost: <strong>{microUsdToString(stats.jobRecommend.costMicroUsd)}</strong>
      </p>
    </section>
  );
}
