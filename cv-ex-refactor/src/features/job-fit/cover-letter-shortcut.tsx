'use client';

import Link from 'next/link';
import { MdEditNote } from 'react-icons/md';

interface Props {
  jobId: string;
}

/**
 * v0.4 shortcut button on Job Fit detail → /refined-cv with cover-letter
 * intent. CoverLetterBlock scrolls itself into view on mount when the
 * intent param is set, so the user lands directly on the generator
 * without scrolling the aside themselves.
 *
 * Tier-agnostic: any tier can be useful for a cover letter (even D/E
 * users may want to apply as a stretch). Quota gates abuse, not UI.
 */
export function CoverLetterShortcut({ jobId }: Props) {
  const href = `/refined-cv?jobId=${encodeURIComponent(jobId)}&intent=cover-letter#cover-letter`;
  return (
    <Link
      href={href}
      aria-label="Tạo Cover Letter cho job này"
      className={[
        'inline-flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2',
        'text-label-md font-medium text-primary',
        'transition-opacity hover:bg-surface-container-low',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10',
      ].join(' ')}
    >
      <MdEditNote size={18} aria-hidden="true" />
      Tạo Cover Letter
    </Link>
  );
}
