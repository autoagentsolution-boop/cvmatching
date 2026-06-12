// Server component — reads directly from storage; no HTTP roundtrip.
// Mounted on the dashboard root + the interview landing page.

import Link from 'next/link';
import { MdRecordVoiceOver, MdArrowForward } from 'react-icons/md';
import { listUserHistory, type HistoryRow } from '@/lib/interview/storage';

interface HistoryWidgetProps {
  userId: string;
  limit?: number;
  /** VI labels — server components can't read the client locale store, so
   *  pass strings in OR default to the VI source-of-truth. */
  labels?: {
    title: string;
    empty: string;
    viewResults: string;
    resume: string;
  };
}

const DEFAULT_LABELS = {
  title: 'Phiên luyện gần đây',
  empty: 'Chưa có phiên nào. Bắt đầu phiên đầu từ Job Fit hoặc trang Luyện phỏng vấn.',
  viewResults: 'Xem kết quả',
  resume: 'Tiếp tục',
};

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 60) return `${Math.max(1, diffMin)}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function statusColor(s: HistoryRow['status']): string {
  if (s === 'completed') return 'bg-tertiary-container text-on-tertiary-container';
  if (s === 'in_progress') return 'bg-primary-container text-on-primary-container';
  return 'bg-on-surface/10 text-on-surface-variant';
}

export async function HistoryWidget({ userId, limit = 5, labels = DEFAULT_LABELS }: HistoryWidgetProps) {
  const rows = await listUserHistory(userId, limit);

  return (
    <section aria-label={labels.title} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-soft">
      <header className="mb-4 flex items-center gap-2">
        <MdRecordVoiceOver className="text-primary" size={20} aria-hidden="true" />
        <h2 className="text-title-md font-bold text-on-surface">{labels.title}</h2>
      </header>

      {rows.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">{labels.empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const target = r.mode === 'standalone' ? (r.roleTitle ?? '—') : (r.jobId ? `Job ${r.jobId.slice(0, 8)}` : '—');
            const href = r.status === 'completed' ? `/interview/${r.id}/results` : `/interview/${r.id}`;
            const cta = r.status === 'completed' ? labels.viewResults : labels.resume;
            const scoreText = r.overallScore == null ? '—' : r.overallScore.toFixed(1);
            return (
              <li key={r.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 transition-colors hover:bg-surface-container-low"
                >
                  <span className={`inline-flex h-9 w-12 items-center justify-center rounded-md text-label-md font-bold ${statusColor(r.status)}`}>
                    {scoreText}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-body-md text-on-surface">{target}</p>
                    <p className="truncate text-label-sm text-on-surface-variant">
                      {r.anchorRoleTitle} · {formatRelative(r.createdAt)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-label-sm font-semibold text-primary">
                    {cta}
                    <MdArrowForward size={14} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
