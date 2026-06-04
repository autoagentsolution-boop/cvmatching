'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MdRoute, MdAutoAwesome } from 'react-icons/md';
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
  const params = useSearchParams();

  // Wave A pre-fill: /career-path?target=<role>&skillGaps=topic1|topic2|...
  // Runs once on mount; opens aspiration drawer so user sees the seeded values.
  useEffect(() => {
    const target = params.get('target');
    const skillGaps = params.get('skillGaps');
    if (target && target.trim()) {
      setField('targetRole', target.trim().slice(0, 160));
      selectSuggestion(target.trim().slice(0, 160));
      setShowAspiration(true);
    }
    if (skillGaps && skillGaps.trim()) {
      const gapList = skillGaps.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 5);
      if (gapList.length > 0) {
        const noteLine = `Skill gaps đã xác định từ Job Fit: ${gapList.join(', ')}.`;
        const current = useCareerPath.getState().notes;
        if (!current.includes(noteLine)) {
          setField('notes', current ? `${current}\n${noteLine}` : noteLine);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // v0.4: removed the auto-fetch useEffect. It burned a /career-path/suggest
  // quota slot on every cache-miss visit — surprising users who only wanted
  // to skim the page or fill the aspiration form manually. User must now
  // click "Đề xuất hướng phát triển" to consume the slot. Matches the
  // explicit-fetch pattern in job-fit-list-page (commit 0fbcc83 rationale).
  const showSuggestPrompt =
    hasCv && !cacheValid && !isSuggesting && !suggestError && suggestions.length === 0;

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
              <Link href="/analyze">Bắt đầu ở Analyze</Link>
            </Button>
          }
        />
      ) : (
        <>
          {showSuggestPrompt && (
            <Card padding="lg" className="flex flex-col items-start gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-label-md font-bold uppercase tracking-wide text-primary">
                  Đề xuất hướng phát triển
                </span>
                <p className="text-body-md text-on-surface-variant">
                  AI sẽ đọc CV và đề xuất 3-5 hướng phát triển khả thi. Mỗi lần đề xuất tốn 1 lượt quota.
                  {' '}Nếu bạn đã biết hướng đi, có thể bỏ qua bước này và tự nhập aspiration bên dưới.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={fetchSuggestions}
                  leadingIcon={<MdAutoAwesome size={18} aria-hidden="true" />}
                  aria-label="AI đề xuất 3-5 hướng phát triển từ CV"
                >
                  Đề xuất hướng phát triển →
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setShowAspiration(true)}
                  aria-label="Bỏ qua đề xuất, tự nhập aspiration"
                >
                  Tự nhập aspiration
                </Button>
              </div>
            </Card>
          )}

          {(suggestions.length > 0 || isSuggesting || suggestError) && (
            <PathSuggestionsBlock
              suggestions={suggestions}
              selected={selectedSuggestion}
              isLoading={isSuggesting}
              error={suggestError}
              onSelect={selectSuggestion}
              onRetry={fetchSuggestions}
            />
          )}

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
