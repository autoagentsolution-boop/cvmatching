'use client';

import { Button } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { useCareerPath } from './career-path-store';
import { callCareerPath } from './api-client';
import type { CareerPathRequest } from './types';

export function CareerPathActions() {
  // Pull analyze context from whichever source the user last worked with —
  // career-path uses it for summary + detectedRole hinting only (optional).
  const { cvText, language } = useAnalysis();
  const analysisResult = useAnalysis((s) => s.analyzeResult ?? s.jdMatchResult);
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

  // Label changes based on context: picking a suggestion vs. natural auto
  const buttonLabel = result
    ? 'Regenerate roadmap'
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
