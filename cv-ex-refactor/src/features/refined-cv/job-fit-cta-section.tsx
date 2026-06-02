'use client';

/**
 * CTA card injected below the polished CV preview on /refined-cv.
 * On click: writes cvText to sessionStorage['refined-cv-text:v1'] then
 * navigates to /job-fit. Uses useAnalysis to access the generated CV text.
 */

import { useRouter } from 'next/navigation';
import { MdWork } from 'react-icons/md';
import { Button, Card } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';

const SESSION_KEY = 'refined-cv-text:v1';

export function JobFitCtaSection() {
  const router = useRouter();
  const { matchedCv } = useAnalysis();

  if (!matchedCv) return null;

  function handleClick() {
    if (matchedCv) {
      try {
        sessionStorage.setItem(SESSION_KEY, matchedCv);
      } catch {
        // sessionStorage write failed (private mode / quota exceeded).
        // Do NOT navigate — user would land on empty state with no way to recover.
        // Using alert() as MVP; no shared toast utility exists in this codebase yet.
        console.warn('[refined-cv] Could not write to sessionStorage.');
        alert('Không lưu được dữ liệu phiên — hãy thử lại hoặc tắt chế độ duyệt web riêng tư.');
        return;
      }
    }
    router.push('/job-fit');
  }

  return (
    <Card padding="md" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-label-md font-bold text-on-surface">
          Tìm job phù hợp với CV này
        </span>
        <span className="text-body-sm text-on-surface-variant">
          AI sẽ đề xuất 5–10 job + chủ đề ôn luyện riêng cho từng vị trí.
        </span>
      </div>
      <Button
        variant="primary"
        size="md"
        onClick={handleClick}
        leadingIcon={<MdWork aria-hidden="true" />}
        aria-label="Tìm 10 job phù hợp và chủ đề ôn luyện"
      >
        Tìm 10 job phù hợp + chủ đề ôn luyện →
      </Button>
    </Card>
  );
}
