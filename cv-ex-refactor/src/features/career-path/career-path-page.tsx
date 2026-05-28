'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MdRoute } from 'react-icons/md';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Card } from '@/components/ui';
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
  const [showAspiration, setShowAspiration] = useState(false);

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
          subtitle="Dựa trên CV hiện tại, AI sẽ dựng lộ trình phát triển sự nghiệp tự nhiên — bạn có thể tinh chỉnh nếu muốn rẽ hướng khác."
        />
      }
    >
      {!hasCv ? (
        <EmptyState
          icon={<MdRoute className="text-4xl" aria-hidden="true" />}
          title="Cần CV để bắt đầu"
          description="Hãy phân tích CV ở trang Analyze trước — chúng tôi sẽ dùng kết quả đó để dựng lộ trình tự nhiên cho bạn."
          action={
            <Button asChild variant="primary">
              <Link href="/">Go to Analyze</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-label-md font-bold uppercase tracking-wide text-primary">
                {result ? 'Lộ trình hiện tại' : 'Sẵn sàng dựng lộ trình'}
              </span>
              <p className="text-body-md text-on-surface-variant">
                {result
                  ? 'Bạn có thể tinh chỉnh aspiration bên dưới và Regenerate để có lộ trình theo hướng mong muốn.'
                  : analysisResult
                    ? `AI sẽ tham chiếu CV của bạn (${analysisResult.detectedRole ?? 'role đã phát hiện'}) và đề xuất lộ trình tự nhiên — không cần điền gì thêm.`
                    : 'Click Generate để AI phân tích CV và đề xuất lộ trình sự nghiệp tự nhiên.'}
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CareerPathActions />
              <button
                type="button"
                onClick={() => setShowAspiration((v) => !v)}
                className="text-label-md font-medium text-on-tertiary-container hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10 rounded"
              >
                {showAspiration ? '− Ẩn tuỳ chỉnh aspiration' : '+ Tuỳ chỉnh aspiration (nếu muốn rẽ hướng khác)'}
              </button>
            </div>
          </Card>

          {showAspiration && <AspirationInputBlock />}

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
