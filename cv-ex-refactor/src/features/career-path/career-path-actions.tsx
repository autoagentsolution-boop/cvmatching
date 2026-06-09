'use client';

import { Button } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { useCareerPath } from './career-path-store';
import { useCareerSource } from './use-career-source';
import { callCareerPath } from './api-client';
import type { CareerPathRequest } from './types';

export function CareerPathActions() {
  // Source resolved from URL `?from=analyze|jd-matching|job-fit` — drives
  // which CV slot + which analysis result hints feed the LLM call.
  const { cvText, analysisResult } = useCareerSource();
  const language = useAnalysis((s) => s.language);
  const { provider, model, temperature, baseUrl } = useSettings();
  const {
    isGenerating,
    result,
    selectedSuggestion,
    getAspiration,
    setField,
  } = useCareerPath();

  const hasCv = cvText.trim().length >= 50;
  const canGenerate = hasCv && !isGenerating;

  async function handleGenerate() {
    setField('error', null);
    setField('isGenerating', true);

    const aspiration = getAspiration();
    const llm: CareerPathRequest['llm'] = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
    };

    const payload: CareerPathRequest = {
      llm,
      inputs: {
        cvText,
        ...(analysisResult?.summary ? { analysisSummary: analysisResult.summary } : {}),
        ...(analysisResult?.detectedRole ? { currentRole: analysisResult.detectedRole } : {}),
        aspiration,
        language,
      },
    };

    try {
      const res = await callCareerPath(payload);
      const { quotaRemaining, ...career } = res;
      setField('result', career);
      setField('quotaRemaining', quotaRemaining);
    } catch (e) {
      setField('error', e instanceof Error ? e.message : 'Tạo lộ trình thất bại.');
    } finally {
      setField('isGenerating', false);
    }
  }

  // Track whether the user has changed direction since the last roadmap.
  // If selectedSuggestion is set AND differs from the current result's
  // target, the button needs to advertise "rebuild for new target" not
  // "regenerate same thing" — otherwise users who pick a fresh suggestion
  // after a successful generation can't tell whether clicking will rebuild
  // for the new pick or just re-run the old roadmap.
  const aspirationChanged =
    !!result &&
    !!selectedSuggestion &&
    selectedSuggestion.trim().toLowerCase() !==
      (result.targetRole?.title ?? '').trim().toLowerCase();

  const buttonLabel = result
    ? aspirationChanged
      ? `Rebuild roadmap → ${selectedSuggestion}`
      : 'Regenerate current roadmap'
    : selectedSuggestion
      ? `Build roadmap → ${selectedSuggestion}`
      : 'Generate roadmap from my CV';

  return (
    <Button
      variant="primary"
      size="lg"
      onClick={handleGenerate}
      disabled={!canGenerate}
      loading={isGenerating}
    >
      {buttonLabel}
    </Button>
  );
}
