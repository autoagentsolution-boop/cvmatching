'use client';

import Link from 'next/link';
import { MdArrowForward, MdOpenInNew } from 'react-icons/md';
import type { TierLetter } from '@/lib/jobs/fit-tier';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

export type CvMode = 'apply' | 'fill-gaps' | 'stretch';

interface ActionDef {
  label: string;
  href: (job: JobMatchOut) => string;
  intent: 'primary' | 'secondary';
  /** When true, treat href as external — open in new tab + add MdOpenInNew icon. */
  external?: boolean;
}

function refinedHref(jobId: string, mode: CvMode): string {
  const params = new URLSearchParams({ jobId, mode });
  return `/refined-cv?${params.toString()}`;
}

function careerHref(job: JobMatchOut): string {
  const topGaps = job.studyTopics.slice(0, 3).map((t) => t.name).join('|');
  const params = new URLSearchParams({
    from: 'job-fit',
    target: `${job.title} @ ${job.company}`,
    skillGaps: topGaps,
  });
  return `/career-path?${params.toString()}`;
}

// S/A tiers: "Apply ngay" now opens the EXTERNAL job posting in a new tab —
// previously it sent users to /refined-cv which surprised them (the label
// implies applying to the job, not refining CV first). The refine flow is
// available as the secondary action.
// B tier "Quick Fix" / C tier "Improve CV" relabeled: "Refine cho job này" /
// "Polish CV (stretch)" so the destination + intent are obvious before click.
function applyHref(job: JobMatchOut): string {
  return job.sourceUrl ?? refinedHref(job.jobId, 'apply');
}

const ACTION_PER_TIER: Record<TierLetter, ActionDef> = {
  S: { label: 'Apply ngay', intent: 'primary', href: applyHref, external: true },
  A: { label: 'Apply ngay', intent: 'primary', href: applyHref, external: true },
  B: {
    label: 'Refine cho job này',
    intent: 'primary',
    href: (j) => refinedHref(j.jobId, 'fill-gaps'),
  },
  C: {
    label: 'Polish CV (stretch)',
    intent: 'secondary',
    href: (j) => refinedHref(j.jobId, 'stretch'),
  },
  D: { label: 'Xem Roadmap', intent: 'secondary', href: careerHref },
  E: { label: 'Xem Roadmap', intent: 'secondary', href: careerHref },
};

interface ActionButtonProps {
  tier: TierLetter;
  job: JobMatchOut;
  size?: 'sm' | 'md';
}

export function ActionButton({ tier, job, size = 'md' }: ActionButtonProps) {
  const action = ACTION_PER_TIER[tier];
  const isPrimary = action.intent === 'primary';
  const href = action.href(job);
  // External applies only when both flagged AND we actually got a non-refined href.
  const isExternal = action.external === true && !href.startsWith('/');

  const base =
    'inline-flex items-center gap-1.5 rounded-lg font-bold transition-opacity hover:opacity-90 ' +
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10';
  const variant = isPrimary
    ? 'bg-primary text-on-primary shadow-soft'
    : 'border border-outline-variant text-primary hover:bg-surface-container-low';
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-label-sm' : 'px-4 py-2 text-label-md';
  const cls = [base, variant, sizing].join(' ');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        aria-label={`${action.label} cho job ${job.title} tại ${job.company} (mở tab mới)`}
      >
        {action.label}
        <MdOpenInNew size={16} aria-hidden="true" />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={cls}
      aria-label={`${action.label} cho job ${job.title} tại ${job.company}`}
    >
      {action.label}
      <MdArrowForward size={16} aria-hidden="true" />
    </Link>
  );
}
