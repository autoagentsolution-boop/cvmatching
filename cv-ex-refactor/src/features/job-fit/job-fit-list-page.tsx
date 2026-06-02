'use client';

import { MdWork, MdRefresh } from 'react-icons/md';
import { DashboardLayout } from '@/components/layouts';
import { Button, Card, PageHeader, LoadingState, ErrorState } from '@/components/ui';
import { useJobFit, isCacheValid } from './job-fit-store';
import { JobCard } from './job-card';
import { EmptyStateNeedCv } from './empty-state-need-cv';

const CV_SESSION_KEY = 'refined-cv-text:v1';

function readCvText(): string | null {
  try {
    return sessionStorage.getItem(CV_SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * /job-fit list page orchestrator.
 *
 * Flow (explicit-fetch, no auto-trigger):
 *  1. Read cvText from sessionStorage['refined-cv-text:v1']
 *  2. If no CV → <EmptyStateNeedCv />
 *  3. If CV + cache valid → render list (+ optional "Refresh" button)
 *  4. If CV + no cache → show "Tìm job phù hợp" button — user-driven.
 *  5. Loading/error states render as usual.
 *
 * Removed pre-2026-06-02 auto-fetch useEffect: it spent a Gemini call on
 * every page revisit once the 6h cache expired, which surprised users and
 * burned shared-key budget.
 */
export function JobFitListPage() {
  const { jobs, status, error, generate, quotaRemaining } = useJobFit();
  const cacheValid = isCacheValid(useJobFit.getState());

  const cvText = readCvText();
  const hasCv = Boolean(cvText && cvText.trim().length >= 200);

  function handleFetch() {
    const text = readCvText();
    if (text) void generate(text);
  }

  const showFetchPrompt =
    hasCv && !cacheValid && status !== 'loading' && status !== 'error';

  return (
    <DashboardLayout activeNav="job-fit" topnavTitle="Job Fit & Study">
      <PageHeader
        title={
          <>
            Job Fit &{' '}
            <span className="text-on-tertiary-container">Study</span>
          </>
        }
        subtitle="AI đề xuất các vị trí phù hợp với CV của bạn cùng chủ đề ôn luyện cho từng job."
      />

      {/* Empty: no CV in session */}
      {!hasCv && !cacheValid && status !== 'loading' && status !== 'error' && (
        <EmptyStateNeedCv />
      )}

      {/* CV present, no cache, idle — explicit fetch prompt */}
      {showFetchPrompt && (
        <Card padding="lg" className="flex flex-col items-start gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-label-md font-semibold text-on-surface">
              Sẵn sàng tìm job phù hợp với CV của bạn
            </p>
            <p className="text-body-sm text-on-surface-variant">
              Mỗi lần tìm tốn 1 lượt quota. Kết quả cache 6 giờ — sau đó bấm nút này để tìm lại.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleFetch}
            leadingIcon={<MdWork aria-hidden="true" />}
            aria-label="Tìm job phù hợp"
          >
            Tìm job phù hợp →
          </Button>
        </Card>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <LoadingState
          variant="spinner"
          size="lg"
          message="Đang tìm job phù hợp với CV của bạn..."
          className="py-16"
        />
      )}

      {/* Error */}
      {status === 'error' && !cacheValid && (
        <ErrorState
          title="Đề xuất job thất bại"
          description={error ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'}
          {...(hasCv ? { retry: handleFetch } : {})}
        />
      )}

      {/* Loaded list */}
      {cacheValid && jobs.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-label-sm text-on-surface-variant">
              {jobs.length} job phù hợp — nhấn &quot;Xem chi tiết&quot; để xem điểm chi tiết và chủ đề ôn luyện.
            </p>
            <div className="flex items-center gap-3">
              {quotaRemaining != null && (
                <p className="text-xs text-muted-foreground">Còn lại: {quotaRemaining} lần hôm nay</p>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFetch}
                leadingIcon={<MdRefresh aria-hidden="true" />}
                aria-label="Tìm lại job phù hợp"
              >
                Tìm lại
              </Button>
            </div>
          </div>
          {jobs.map((match) => (
            <JobCard key={match.jobId} match={match} />
          ))}
        </div>
      )}

      {/* Edge: success but zero matches (shouldn't happen — API errors on 0 matches) */}
      {status === 'success' && jobs.length === 0 && (
        <ErrorState
          title="Không có job phù hợp"
          description="Không tìm thấy job nào khớp đủ cao. Hãy bổ sung thêm kinh nghiệm vào CV và thử lại."
          {...(hasCv ? { retry: handleFetch } : {})}
        />
      )}
    </DashboardLayout>
  );
}
