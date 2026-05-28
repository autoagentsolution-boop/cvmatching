'use client';

import Link from 'next/link';
import { MdRoute } from 'react-icons/md';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { FormPageLayout } from '@/components/layouts';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useCareerPath } from './career-path-store';
import { AspirationInputBlock } from './aspiration-input-block';
import { CareerPathActions } from './career-path-actions';
import { CurrentSnapshotBlock } from './current-snapshot-block';
import { FeasibilityBanner } from './feasibility-banner';
import { RoadmapTimelineBlock } from './roadmap-timeline-block';
import { SkillGapsBlock } from './skill-gaps-block';
import { AlternativePathsBlock } from './alternative-paths-block';
import { QuickWinsBlock } from './quick-wins-block';

export function CareerPathPage() {
  const { cvText, result: analysisResult } = useAnalysis();
  const { result, isGenerating, error } = useCareerPath();

  const hasCv = cvText.trim().length >= 50;

  return (
    <FormPageLayout
      className="max-w-[1180px]"
      header={
        <PageHeader
          title={
            <>
              Map your{' '}
              <span className="text-on-tertiary-container">career path.</span>
            </>
          }
          subtitle="Dùng CV của bạn + một vài định hướng để AI dựng lộ trình sự nghiệp, các kỹ năng cần xây và những hành động cụ thể trong 90 ngày tới."
        />
      }
      actionsSlot={hasCv ? <CareerPathActions /> : undefined}
    >
      {!hasCv ? (
        <EmptyState
          icon={<MdRoute className="text-4xl" aria-hidden="true" />}
          title="Cần CV để bắt đầu"
          description="Hãy phân tích CV ở trang Analyze trước, hoặc paste/upload CV ở đó — chúng tôi sẽ tự dùng kết quả phân tích ở đây."
          action={
            <Button asChild variant="primary">
              <Link href="/">Go to Analyze</Link>
            </Button>
          }
        />
      ) : (
        <>
          {analysisResult && (
            <div className="rounded-xl bg-surface-container-low px-4 py-3 text-body-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">CV đã được phân tích — </span>
              AI sẽ tham chiếu tóm tắt + role phát hiện được. Có thể tinh chỉnh aspiration bên dưới.
            </div>
          )}

          <AspirationInputBlock />

          {isGenerating && (
            <LoadingState
              variant="spinner"
              size="lg"
              message="Đang xây lộ trình sự nghiệp..."
              className="py-12"
            />
          )}

          {error && !isGenerating && (
            <ErrorState title="Tạo lộ trình thất bại" description={error} />
          )}

          {result && !isGenerating && (
            <div className="flex flex-col gap-6">
              <FeasibilityBanner feasibility={result.feasibility} />
              <CurrentSnapshotBlock snapshot={result.currentSnapshot} target={result.targetRole} />
              {result.milestones.length > 0 && (
                <RoadmapTimelineBlock milestones={result.milestones} />
              )}
              <SkillGapsBlock gaps={result.skillGaps} />
              <AlternativePathsBlock paths={result.alternativePaths} />
              <QuickWinsBlock quickWins={result.quickWins} />
              {result.caveats && (
                <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                  <span className="font-semibold text-on-surface">Lưu ý: </span>{result.caveats}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </FormPageLayout>
  );
}
