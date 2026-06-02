'use client';

import Link from 'next/link';
import { MdList } from 'react-icons/md';
import { Button, EmptyState } from '@/components/ui';

/**
 * Shown on /job-fit/[jobId] when the match is not found in sessionStorage.
 * Direct-link visits (no session) land here — explains why and offers CTA back.
 */
export function EmptyStateBackToList() {
  return (
    <EmptyState
      icon={<MdList className="text-4xl" aria-hidden="true" />}
      title="Không tìm thấy kết quả"
      description="Dữ liệu job này chỉ lưu trong phiên làm việc. Hãy quay lại danh sách và tạo lại đề xuất từ CV của bạn."
      action={
        <Button asChild variant="primary">
          <Link href="/job-fit">Xem danh sách jobs</Link>
        </Button>
      }
    />
  );
}
