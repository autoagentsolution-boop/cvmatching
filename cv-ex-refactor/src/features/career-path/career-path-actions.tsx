'use client';

import { Button } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { useCareerPath } from './career-path-store';
import { callCareerPath } from './api-client';
import type { CareerPathRequest } from './types';

export function CareerPathActions() {
  const { cvText, result: analysisResult, language } = useAnalysis();
  const { provider, model, temperature, baseUrl } = useSettings();
  const {
    isGenerating,
    result,
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

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="primary"
        size="lg"
        onClick={handleGenerate}
        disabled={!canGenerate}
        loading={isGenerating}
      >
        {result ? 'Regenerate roadmap' : 'Generate roadmap'}
      </Button>
      {!hasCv && (
        <span className="text-label-sm text-on-surface-variant">
          Cần CV (≥ 50 ký tự) — hãy Analyze CV trước hoặc paste CV ở trang Analyze.
        </span>
      )}
    </div>
  );
}
