'use client';

import Link from 'next/link';
import { MdWork } from 'react-icons/md';
import { Button, EmptyState } from '@/components/ui';

/**
 * Shown on /job-fit when no cvText is found in sessionStorage.
 * CTA directs user to /refined-cv to generate a CV first.
 */
export function EmptyStateNeedCv() {
  return (
    <EmptyState
      icon={<MdWork className="text-4xl" aria-hidden="true" />}
      title="Cần Refined CV trước"
      description="Hãy tạo Refined CV ở trang Refined CV — sau đó nhấn 'Tìm job phù hợp' để AI đề xuất các vị trí và chủ đề ôn luyện."
      action={
        <Button asChild variant="primary">
          <Link href="/refined-cv">Đến trang Refined CV</Link>
        </Button>
      }
    />
  );
}
