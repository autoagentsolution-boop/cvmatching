'use client';

import { useT } from '@/lib/i18n/use-t';

interface ResultsSummaryProps {
  overallScore: number | null;
  modeLabel: string;
  targetLabel: string;
  anchorRoleTitle: string;
  completedAt: string | null;
}

export function ResultsSummary({
  overallScore,
  modeLabel,
  targetLabel,
  anchorRoleTitle,
  completedAt,
}: ResultsSummaryProps) {
  const t = useT();
  const scoreText = overallScore == null ? '—' : overallScore.toFixed(1);
  return (
    <section
      aria-label={t('interview.results.overallScore')}
      className="rounded-3xl border border-outline-variant bg-gradient-to-br from-tertiary-container via-surface-container-low to-surface p-8 shadow-soft"
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('interview.results.overallScore')}
          </p>
          <p className="font-display text-display-md font-bold text-on-tertiary-container">
            {scoreText}
            <span className="ml-2 text-headline-sm font-medium text-on-surface-variant">/10</span>
          </p>
          <p className="text-body-sm text-on-surface-variant">{t('interview.results.subtitle')}</p>
        </div>
        <dl className="grid gap-2 text-body-sm text-on-surface min-w-[200px]">
          <div>
            <dt className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">Mode</dt>
            <dd>{modeLabel}</dd>
          </div>
          <div>
            <dt className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">Target</dt>
            <dd>{targetLabel}</dd>
          </div>
          <div>
            <dt className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">Anchor role</dt>
            <dd>{anchorRoleTitle}</dd>
          </div>
          {completedAt && (
            <div>
              <dt className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">Completed</dt>
              <dd>{new Date(completedAt).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
