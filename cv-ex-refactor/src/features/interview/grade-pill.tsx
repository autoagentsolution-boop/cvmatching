'use client';

import { useT } from '@/lib/i18n/use-t';

interface GradePillProps {
  /** Integer 0..10 from interviewGradeSchema. */
  score: number;
}

type Bucket = 'fail' | 'weak' | 'solid' | 'excellent';

function bucketOf(score: number): Bucket {
  if (score <= 2) return 'fail';
  if (score <= 5) return 'weak';
  if (score <= 7) return 'solid';
  return 'excellent';
}

const TONES: Record<Bucket, string> = {
  fail: 'bg-error-container text-on-error-container border-error/30',
  weak: 'bg-error-container/40 text-on-error-container border-error/20',
  solid: 'bg-tertiary-container text-on-tertiary-container border-on-tertiary-container/30',
  excellent: 'bg-primary text-on-primary border-primary/40',
};

const LABEL_KEYS: Record<Bucket, 'interview.grade.fail' | 'interview.grade.weak' | 'interview.grade.solid' | 'interview.grade.excellent'> = {
  fail: 'interview.grade.fail',
  weak: 'interview.grade.weak',
  solid: 'interview.grade.solid',
  excellent: 'interview.grade.excellent',
};

export function GradePill({ score }: GradePillProps) {
  const t = useT();
  const clamped = Math.max(0, Math.min(10, Math.round(score)));
  const bucket = bucketOf(clamped);
  const label = t(LABEL_KEYS[bucket]);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-label-md font-bold ${TONES[bucket]}`}
      aria-label={`Score ${clamped}/10: ${label}`}
    >
      <span aria-hidden="true">{clamped}/10</span>
      <span aria-hidden="true">·</span>
      <span>{label}</span>
    </span>
  );
}
