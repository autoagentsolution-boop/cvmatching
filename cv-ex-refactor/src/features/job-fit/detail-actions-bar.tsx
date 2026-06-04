'use client';

import Link from 'next/link';
import { MdArrowBack, MdOpenInNew } from 'react-icons/md';
import { Button } from '@/components/ui';
import { ActionButton } from './action-button';
import { CoverLetterShortcut } from './cover-letter-shortcut';
import type { TierLetter } from '@/lib/jobs/fit-tier';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

interface DetailActionsBarProps {
  job: JobMatchOut;
  /** Source platform name shown in the Apply button label. */
  source?: string;
}

// Sticky action bar at bottom of /job-fit/[jobId] detail page.
// Order: back ← (open-source) ← per-tier primary action
// Tier S/A: "Apply ngay" → /refined-cv?mode=apply (primary)
// Tier B:   "Quick Fix" → /refined-cv?mode=fill-gaps
// Tier C:   "Improve CV" → /refined-cv?mode=stretch
// Tier D/E: "Roadmap" → /career-path with pre-fill
export function DetailActionsBar({ job, source }: DetailActionsBarProps) {
  const sourceLabel = source ?? 'trang tuyển dụng';
  const lowTier: TierLetter[] = ['D', 'E'];
  const showSourceApply = !lowTier.includes(job.tier);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
      <Button asChild variant="ghost" size="md">
        <Link href="/job-fit" aria-label="Quay lại danh sách jobs">
          <MdArrowBack size={18} aria-hidden="true" />
          Quay lại danh sách
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        {showSourceApply && (
          <a
            href={`/api/r/${job.jobId}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Mở trang gốc trên ${sourceLabel} trong tab mới`}
            className={[
              'inline-flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2',
              'text-label-md font-medium text-primary',
              'transition-opacity hover:bg-surface-container-low',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10',
            ].join(' ')}
          >
            Mở trên {sourceLabel}
            <MdOpenInNew size={16} aria-hidden="true" />
          </a>
        )}
        <CoverLetterShortcut jobId={job.jobId} />
        <ActionButton tier={job.tier} job={job} size="md" />
      </div>
    </div>
  );
}
