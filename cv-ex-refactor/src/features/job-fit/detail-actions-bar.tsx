'use client';

import Link from 'next/link';
import { MdArrowBack, MdOpenInNew } from 'react-icons/md';
import { Button } from '@/components/ui';

interface DetailActionsBarProps {
  jobId: string;
  /** Source platform name shown in the Apply button label. */
  source?: string;
}

/**
 * Sticky action bar at bottom of /job-fit/[jobId] detail page.
 * - Apply button: opens /api/r/[jobId] in new tab (Phase 4 ships the redirect route).
 * - Back link: returns to /job-fit list.
 */
export function DetailActionsBar({ jobId, source }: DetailActionsBarProps) {
  const sourceLabel = source ?? 'trang tuyển dụng';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
      <Button asChild variant="ghost" size="md">
        <Link href="/job-fit" aria-label="Quay lại danh sách jobs">
          <MdArrowBack size={18} aria-hidden="true" />
          Quay lại danh sách
        </Link>
      </Button>

      <a
        href={`/api/r/${jobId}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ứng tuyển trên ${sourceLabel}, mở trong tab mới`}
        className={[
          'inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3',
          'text-label-md font-medium text-on-primary shadow-soft',
          'transition-opacity hover:opacity-90',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10',
        ].join(' ')}
      >
        Apply trên {sourceLabel}
        <MdOpenInNew size={16} aria-hidden="true" />
      </a>
    </div>
  );
}
