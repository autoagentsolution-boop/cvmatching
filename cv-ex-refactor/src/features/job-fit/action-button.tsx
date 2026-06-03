'use client';

import Link from 'next/link';
import { MdArrowForward } from 'react-icons/md';
import type { TierLetter } from '@/lib/jobs/fit-tier';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

export type CvMode = 'apply' | 'fill-gaps' | 'stretch';

interface ActionDef {
  label: string;
  href: (job: JobMatchOut) => string;
  intent: 'primary' | 'secondary';
}

function refinedHref(jobId: string, mode: CvMode): string {
  const params = new URLSearchParams({ jobId, mode });
  return `/refined-cv?${params.toString()}`;
}

function careerHref(job: JobMatchOut): string {
  const topGaps = job.studyTopics.slice(0, 3).map((t) => t.name).join('|');
  const params = new URLSearchParams({
    target: `${job.title} @ ${job.company}`,
    skillGaps: topGaps,
  });
  return `/career-path?${params.toString()}`;
}

const ACTION_PER_TIER: Record<TierLetter, ActionDef> = {
  S: { label: 'Apply ngay', intent: 'primary', href: (j) => refinedHref(j.jobId, 'apply') },
  A: { label: 'Apply ngay', intent: 'primary', href: (j) => refinedHref(j.jobId, 'apply') },
  B: { label: 'Quick Fix', intent: 'primary', href: (j) => refinedHref(j.jobId, 'fill-gaps') },
  C: { label: 'Improve CV', intent: 'secondary', href: (j) => refinedHref(j.jobId, 'stretch') },
  D: { label: 'Xem Roadmap', intent: 'secondary', href: careerHref },
  E: { label: 'Xem Roadmap', intent: 'secondary', href: careerHref },
};

interface ActionButtonProps {
  tier: TierLetter;
  job: JobMatchOut;
  size?: 'sm' | 'md';
}

// Per-tier primary CTA: S/A/B → /refined-cv with mode; C → /refined-cv stretch; D/E → /career-path roadmap.
// Intent: B+C+D+E are diagnostic/exploratory → secondary visual weight; S/A → primary.
export function ActionButton({ tier, job, size = 'md' }: ActionButtonProps) {
  const action = ACTION_PER_TIER[tier];
  const isPrimary = action.intent === 'primary';

  const base =
    'inline-flex items-center gap-1.5 rounded-lg font-bold transition-opacity hover:opacity-90 ' +
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10';
  const variant = isPrimary
    ? 'bg-primary text-on-primary shadow-soft'
    : 'border border-outline-variant text-primary hover:bg-surface-container-low';
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-label-sm' : 'px-4 py-2 text-label-md';

  return (
    <Link
      href={action.href(job)}
      className={[base, variant, sizing].join(' ')}
      aria-label={`${action.label} cho job ${job.title} tại ${job.company}`}
    >
      {action.label}
      <MdArrowForward size={16} aria-hidden="true" />
    </Link>
  );
}
