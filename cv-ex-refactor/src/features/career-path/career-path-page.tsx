'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MdRoute } from 'react-icons/md';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Card } from '@/components/ui';
import { FormPageLayout } from '@/components/layouts';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { useCareerPath, cvCacheKey } from './career-path-store';
import { callSuggestPaths } from './api-client';
import type { SuggestPathsRequest } from './types';
import { AspirationInputBlock } from './aspiration-input-block';
import { CareerPathActions } from './career-path-actions';
import { CurrentSnapshotBlock } from './current-snapshot-block';
import { FeasibilityBanner } from './feasibility-banner';
import { PathSuggestionsBlock } from './path-suggestions-block';
import { RoadmapTimelineBlock } from './roadmap-timeline-block';
import { SkillGapsBlock } from './skill-gaps-block';
import { AlternativePathsBlock } from './alternative-paths-block';
import { QuickWinsBlock } from './quick-wins-block';

export function CareerPathPage() {
  const { cvText, result: analysisResult, language } = useAnalysis();
  const { provider, model, temperature, baseUrl } = useSettings();
  const {
    suggestions,
    selectedSuggestion,
    suggestionsCacheKey,
    isSuggesting,
    suggestError,
    result,
    isGenerating,
    error,
    setField,
    selectSuggestion,
  } = useCareerPath();
  const [showAspiration, setShowAspiration] = useState(false);

  const hasCv = cvText.trim().length >= 50;
  const currentCacheKey = hasCv ? cvCacheKey(cvText) : null;
  const cacheValid =
    suggestions.length > 0 && suggestionsCacheKey === currentCacheKey;

  async function fetchSuggestions() {
    if (!hasCv) return;
    setField('suggestError', null);
    setField('isSuggesting', true);
    const payload: SuggestPathsRequest = {
      llm: { provider, model, temperature, ...(baseUrl ? { baseUrl } : {}) },
      inputs: {
        cvText,
        ...(analysisResult?.summary ? { analysisSummary: analysisResult.summary } : {}),
        ...(analysisResult?.detectedRole ? { currentRole: analysisResult.detectedRole } : {}),
        language,
      },
    };
    try {
      const list = await callSuggestPaths(payload);
      setField('suggestions', list);
      setField('suggestionsCacheKey', currentCacheKey);
    } catch (e) {
      setField('suggestError', e instanceof Error ? e.message : 'Đề xuất thất bại.');
    } finally {
      setField('isSuggesting', false);
    }
  }

  // Auto-fetch suggestions once when CV is present and cache miss.
  useEffect(() => {
    if (hasCv && !cacheValid && !isSuggesting && !suggestError) {
      void fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCv, cacheValid]);

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
          subtitle="AI phân tích CV và đề xuất các hướng phát triển — chọn một hướng để dựng roadmap chi tiết, hoặc tuỳ chỉnh aspiration nếu muốn rẽ hướng khác."
        />
      }
    >
      {!hasCv ? (
        <EmptyState
          icon={<MdRoute className="text-4xl" aria-hidden="true" />}
          title="Cần phân tích CV trước"
          description="Career Path đề xuất hướng nghề nghiệp dài hạn dựa trên CV của bạn. Hãy bắt đầu ở Analyze (paste CV) — kết quả sẽ dùng để gợi ý 3-5 path khả thi + roadmap."
          action={
            <Button asChild variant="primary">
              <Link href="/">Bắt đầu ở Analyze</Link>
            </Button>
          }
        />
      ) : (
        <>
          <PathSuggestionsBlock
            suggestions={suggestions}
            selected={selectedSuggestion}
            isLoading={isSuggesting}
            error={suggestError}
            onSelect={selectSuggestion}
            onRetry={fetchSuggestions}
          />

          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-label-md font-bold uppercase tracking-wide text-primary">
                {result ? 'Lộ trình hiện tại' : 'Sẵn sàng dựng lộ trình'}
              </span>
              <p className="text-body-md text-on-surface-variant">
                {selectedSuggestion
                  ? `Sẽ dựng roadmap cho hướng "${selectedSuggestion}". Click Generate.`
                  : result
                    ? 'Bạn có thể chọn hướng khác ở trên hoặc tinh chỉnh aspiration và Regenerate.'
                    : 'Chọn một hướng phía trên, hoặc click Generate để AI tự đề xuất lộ trình tự nhiên từ CV.'}
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CareerPathActions />
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowAspiration((v) => !v)}
              >
                {showAspiration ? 'Ẩn tuỳ chỉnh' : 'Tuỳ chỉnh aspiration'}
              </Button>
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
