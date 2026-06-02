'use client';

import Link from 'next/link';
import { MdWork } from 'react-icons/md';
import { Button, EmptyState } from '@/components/ui';

/**
 * Shown on /job-fit when no cvText is found in sessionStorage.
 * CTA goes straight to Analyze — the chain root — instead of hopping
 * via /refined-cv, which would itself dead-end at the same Analyze CTA.
 */
export function EmptyStateNeedCv() {
  return (
    <EmptyState
      icon={<MdWork className="text-4xl" aria-hidden="true" />}
      title="Cần phân tích CV trước"
      description="Job Fit cần một Refined CV để match với job pool. Bắt đầu ở trang Analyze (paste CV + JD → nhận điểm + Refined CV → AI gợi ý job phù hợp)."
      action={
        <Button asChild variant="primary">
          <Link href="/">Bắt đầu ở Analyze</Link>
        </Button>
      }
    />
  );
}
