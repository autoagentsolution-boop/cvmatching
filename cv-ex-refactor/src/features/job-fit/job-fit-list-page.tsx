'use client';

import { useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts';
import { PageHeader, LoadingState, ErrorState } from '@/components/ui';
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
 * Flow:
 *  1. Read cvText from sessionStorage['refined-cv-text:v1']
 *  2. If cache valid → render list directly
 *  3. If cvText present but no cache → auto-fetch on mount
 *  4. If neither → <EmptyStateNeedCv />
 */
export function JobFitListPage() {
  const { jobs, status, error, generate, quotaRemaining } = useJobFit();
  const cacheValid = isCacheValid(useJobFit.getState());

  useEffect(() => {
    // Re-read state inside effect to avoid closing over pre-rehydration snapshot.
    const currentState = useJobFit.getState();
    if (isCacheValid(currentState)) return;
    if (currentState.status === 'loading') return;

    const cvText = readCvText();
    if (!cvText || cvText.trim().length < 200) return;

    void generate(cvText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cvText = readCvText();
  const hasCv = Boolean(cvText && cvText.trim().length >= 200);

  function handleRetry() {
    const text = readCvText();
    if (text) void generate(text);
  }

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
          {...(hasCv ? { retry: handleRetry } : {})}
        />
      )}

      {/* Loaded list */}
      {cacheValid && jobs.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-label-sm text-on-surface-variant">
              {jobs.length} job phù hợp — nhấn &quot;Xem chi tiết&quot; để xem điểm chi tiết và chủ đề ôn luyện.
            </p>
            {quotaRemaining != null && (
              <p className="text-xs text-muted-foreground">Còn lại: {quotaRemaining} lần hôm nay</p>
            )}
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
          {...(hasCv ? { retry: handleRetry } : {})}
        />
      )}
    </DashboardLayout>
  );
}
