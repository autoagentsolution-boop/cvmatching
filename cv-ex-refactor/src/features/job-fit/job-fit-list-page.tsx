'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { MdWork, MdRefresh, MdInfoOutline } from 'react-icons/md';
import { Button, Card, PageHeader, LoadingState, ErrorState } from '@/components/ui';
import { useJobFit, isCacheValid } from './job-fit-store';
import { JobCard } from './job-card';
import { JobFitInlineDetail } from './job-fit-inline-detail';
import { EmptyStateNeedCv } from './empty-state-need-cv';
import { ExhaustedPoolBanner } from './exhausted-pool-banner';
import { semanticForTier, type TierLetter } from '@/lib/jobs/fit-tier';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

const TIER_GROUP_ORDER: readonly TierLetter[] = ['S', 'A', 'B', 'C', 'D', 'E'] as const;
const TIER_HEADING_ICON: Record<TierLetter, string> = {
  S: '🚀', A: '⭐', B: '✅', C: '🎯', D: '⚠️', E: '🛑',
};
// Matches topK in /api/jobs/recommend (route.ts). Bump together if changed.
const TARGET_JOBS = 6;

function groupByTier(jobs: JobMatchOut[]): Array<[TierLetter, JobMatchOut[]]> {
  const map: Record<TierLetter, JobMatchOut[]> = { S: [], A: [], B: [], C: [], D: [], E: [] };
  for (const j of jobs) map[j.tier].push(j);
  return TIER_GROUP_ORDER
    .filter((t) => map[t].length > 0)
    .map((t) => [t, map[t]] as [TierLetter, JobMatchOut[]]);
}

const CV_SESSION_KEY = 'refined-cv-text:v1';

function readCvText(): string | null {
  try {
    return sessionStorage.getItem(CV_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeCvText(text: string): void {
  try {
    sessionStorage.setItem(CV_SESSION_KEY, text);
  } catch {
    // private mode / quota exceeded — non-fatal, store state still holds it
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
export type WorkflowMode = 'cv-solo' | 'jd-context';

export interface JobFitListPageProps {
  /** Phase 6: workflow-context hint. Currently passthrough. */
  mode?: WorkflowMode;
  /**
   * CV body loaded by the parent workflow layout. When provided, takes
   * precedence over sessionStorage and is mirrored back into sessionStorage
   * so other consumers (cover letter, career path) see the same CV.
   * Omitted only on the legacy standalone /job-fit route, where we still
   * fall back to whatever was last written to sessionStorage.
   */
  cvText?: string;
  /** Human label for the active CV — surfaced in the "Đang dùng CV: …" banner. */
  cvName?: string;
  /** Interview Practice kill-switch — hides the inline-detail CTA. */
  interviewEnabled?: boolean;
}

export function JobFitListPage({ mode, cvText: cvTextProp, cvName, interviewEnabled = true }: JobFitListPageProps = {}) {
  void mode;
  // Per-field selectors only — see feedback_zustand_object_literal_selector.
  const jobs = useJobFit((s) => s.jobs);
  const status = useJobFit((s) => s.status);
  const generate = useJobFit((s) => s.generate);
  const quotaRemaining = useJobFit((s) => s.quotaRemaining);
  const emptyReason = useJobFit((s) => s.emptyReason);
  const seenPolicy = useJobFit((s) => s.seenPolicy);
  const cacheValid = isCacheValid(useJobFit.getState());

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Workflow-supplied CV wins. Mirror into sessionStorage so downstream
  // (cover letter, career path) see the same CV without us threading it
  // through more props. Old standalone /job-fit users still get the
  // sessionStorage fallback.
  const cvText = cvTextProp ?? readCvText() ?? '';
  const hasCv = cvText.trim().length >= 200;

  useEffect(() => {
    if (cvTextProp && cvTextProp.trim().length > 0) {
      writeCvText(cvTextProp);
    }
  }, [cvTextProp]);

  function handleFetch() {
    if (cvText.trim().length > 0) void generate(cvText);
  }

  // Inline-detail expand state — drives JobFitInlineDetail render below the
  // selected card. Mirrored to ?jobId= in the URL (replace, not push) so a
  // refresh re-opens the same job and the URL is shareable. Default to
  // searchParams on mount.
  const initialExpanded = searchParams.get('jobId');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(initialExpanded);

  function toggleExpanded(jobId: string) {
    const next = expandedJobId === jobId ? null : jobId;
    setExpandedJobId(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('jobId', next);
    else params.delete('jobId');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const showFetchPrompt =
    hasCv && !cacheValid && status !== 'loading' && status !== 'error';

  return (
    <>
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
          description="Hệ thống đang gặp sự cố. Vui lòng thử lại sau."
          {...(hasCv ? { retry: handleFetch } : {})}
        />
      )}

      {/* CV-source banner — surfaces WHICH CV is matched. Addresses the
          "không biết đang dùng original hay refined CV" confusion. Only
          shows when we have a name to label it (workflow-supplied props). */}
      {cvName && hasCv && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-label-sm text-on-surface-variant">
          <MdInfoOutline size={14} aria-hidden="true" />
          <span>
            Đang match với CV: <strong className="text-on-surface">{cvName}</strong>
          </span>
        </div>
      )}

      {/* Loaded list — grouped by tier S→E */}
      {cacheValid && jobs.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-label-sm text-on-surface-variant">
              {jobs.length} job phù hợp — nhấn &quot;Chi tiết&quot; để mở rộng inline xem điểm chi tiết và chủ đề ôn luyện.
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

          {groupByTier(jobs).map(([tier, group]) => (
            <section key={tier} className="flex flex-col gap-3" aria-label={`Tier ${tier}`}>
              <h2 className="font-display text-title-md font-bold text-on-surface">
                <span aria-hidden="true" className="mr-2">{TIER_HEADING_ICON[tier]}</span>
                Tier {tier} — {semanticForTier(tier)}
                <span className="ml-2 text-label-sm font-normal text-on-surface-variant">
                  ({group.length})
                </span>
              </h2>
              {group.map((match) => (
                <div key={match.jobId} className="flex flex-col gap-0">
                  <JobCard
                    match={match}
                    isExpanded={expandedJobId === match.jobId}
                    onToggleDetail={() => toggleExpanded(match.jobId)}
                  />
                  {expandedJobId === match.jobId && (
                    <JobFitInlineDetail match={match} onClose={() => toggleExpanded(match.jobId)} interviewEnabled={interviewEnabled} />
                  )}
                </div>
              ))}
            </section>
          ))}

          {jobs.length < TARGET_JOBS && (
            <Card padding="md" className="border-dashed">
              <p className="text-body-sm text-on-surface-variant">
                Chỉ {jobs.length}/{TARGET_JOBS} jobs match được hôm nay. Thêm jobs sẽ được ingest ngày mai —
                quay lại để xem thêm lựa chọn phù hợp.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Success but zero matches — disambiguated via emptyReason (Phase 7) */}
      {status === 'success' && jobs.length === 0 && emptyReason && (
        <ExhaustedPoolBanner
          seenPolicy={seenPolicy}
          reason={emptyReason}
          onAfterReset={handleFetch}
        />
      )}

      {/* Fallback: legacy "no matches" path (KV admin route or pre-Phase-7 cache) */}
      {status === 'success' && jobs.length === 0 && !emptyReason && (
        <ErrorState
          title="Không có job phù hợp"
          description="Không tìm thấy job nào khớp đủ cao. Hãy bổ sung thêm kinh nghiệm vào CV và thử lại."
          {...(hasCv ? { retry: handleFetch } : {})}
        />
      )}
    </>
  );
}
