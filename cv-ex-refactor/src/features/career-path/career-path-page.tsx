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
import { useCareerSource } from './use-career-source';
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

export type WorkflowMode = 'cv-solo' | 'jd-context';

export interface CareerPathPageProps {
  /** Phase 6: workflow-context hint. Currently passthrough — downstream reads
   *  from analysis-store. */
  mode?: WorkflowMode;
}

export function CareerPathPage({ mode }: CareerPathPageProps = {}) {
  void mode;
  // Source-aware (per `?from=`) CV + analysis result. See use-career-source.
  const { cvText, analysisResult } = useCareerSource();
  const language = useAnalysis((s) => s.language);
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

  // v0.4: no auto-fetch — explicit user action (commit 0a7c408 rationale).
  // Suggest is offered as a small inline link inside the unified Start Card
  // below; the primary CTA stays "Generate roadmap" (works without target —
  // existing API accepts "auto" and infers from CV) so user always has one
  // clear next step regardless of whether they've picked a suggestion or
  // arrived prefilled from /job-fit.
  const showSuggestLink =
    !selectedSuggestion && suggestions.length === 0 && !isSuggesting && !suggestError;

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

          {/* Start Card — renders ONLY before a result exists. After the
              roadmap is generated, this card moves to the bottom as a
              Regenerate panel so it stops sitting between the suggestions
              and the result. The button is the only path to handleGenerate
              (no useEffect / route-change / auto-fire); clicking a
              suggestion above only updates selectedSuggestion. */}
          {!result && (
            <Card padding="lg" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-label-md font-bold uppercase tracking-wide text-primary">
                  {selectedSuggestion
                    ? `Tạo lộ trình cho "${selectedSuggestion}"`
                    : 'Tạo lộ trình sự nghiệp'}
                </span>
                <p className="text-body-md text-on-surface-variant">
                  {selectedSuggestion
                    ? 'Đã chọn hướng. Bấm Generate để dựng roadmap chi tiết.'
                    : 'AI sẽ dựng roadmap tự nhiên từ CV của bạn. Hoặc xem các tùy chọn bên dưới để chọn hướng / tự nhập aspiration trước.'}
                </p>
              </div>

              <div className="flex flex-col items-start gap-3">
                <CareerPathActions />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-sm">
                  {showSuggestLink && (
                    <button
                      type="button"
                      onClick={fetchSuggestions}
                      aria-label="AI đề xuất 3-5 hướng phát triển từ CV (tốn 1 quota)"
                      className="inline-flex items-center gap-1 text-on-tertiary-container underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
                    >
                      <MdAutoAwesome size={14} aria-hidden="true" />
                      AI đề xuất 3-5 hướng trước (1 quota)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAspiration((v) => !v)}
                    className="text-on-tertiary-container underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {showAspiration ? 'Ẩn tuỳ chỉnh aspiration' : 'Tuỳ chỉnh aspiration thủ công'}
                  </button>
                </div>
              </div>
            </Card>
          )}

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

              {/* "Lộ trình hiện tại" panel moved to the BOTTOM per user
                  feedback — used to sit above the result blocks and
                  visually split the page. Now it sits as a footer for
                  regenerate / tweak actions. */}
              <Card padding="lg" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-label-md font-bold uppercase tracking-wide text-primary">
                    Lộ trình hiện tại
                  </span>
                  <p className="text-body-md text-on-surface-variant">
                    Bạn có thể tinh chỉnh aspiration hoặc chọn hướng khác phía trên rồi Regenerate.
                  </p>
                </div>
                <div className="flex flex-col items-start gap-3">
                  <CareerPathActions />
                  <button
                    type="button"
                    onClick={() => setShowAspiration((v) => !v)}
                    className="text-label-sm text-on-tertiary-container underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {showAspiration ? 'Ẩn tuỳ chỉnh aspiration' : 'Tuỳ chỉnh aspiration thủ công'}
                  </button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </FormPageLayout>
  );
}
