'use client';

import { useT } from '@/lib/i18n/use-t';

interface GradePillProps {
  score: 0 | 1 | 2 | 3;
}

const TONES = {
  0: 'bg-error-container text-on-error-container border-error/30',
  1: 'bg-error-container/40 text-on-error-container border-error/20',
  2: 'bg-tertiary-container text-on-tertiary-container border-on-tertiary-container/20',
  3: 'bg-primary text-on-primary border-primary/40',
} as const;

export function GradePill({ score }: GradePillProps) {
  const t = useT();
  const labelKey =
    score === 0 ? ('interview.grade.score0' as const)
    : score === 1 ? ('interview.grade.score1' as const)
    : score === 2 ? ('interview.grade.score2' as const)
    : ('interview.grade.score3' as const);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-label-md font-bold ${TONES[score]}`}
      aria-label={`Grade ${score}: ${t(labelKey)}`}
    >
      <span aria-hidden="true">{score}/3</span>
      <span aria-hidden="true">·</span>
      <span>{t(labelKey)}</span>
    </span>
  );
}
