'use client';

import { Button, ErrorState } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { useSettings } from './settings-store';
import { callAnalyze } from './api-client';
import type { AnalyzeRequest } from './types';

export function AnalyzeActions() {
  const {
    jdText,
    jdUrl,
    cvText,
    profileText,
    targetRole,
    strictness,
    language,
    weights,
    isAnalyzing,
    error,
    setField,
  } = useAnalysis();

  const { useSharedKey, provider, model, temperature, baseUrl, apiKey } = useSettings();

  const canAnalyze = jdText.trim().length > 0 && cvText.trim().length > 0 && !isAnalyzing;

  async function handleAnalyze() {
    setField('error', null);
    setField('isAnalyzing', true);
    setField('result', null);

    const llm: AnalyzeRequest['llm'] = useSharedKey
      ? { provider, model, temperature }
      : {
          provider,
          model,
          temperature,
          ...(baseUrl ? { baseUrl } : {}),
          apiKey,
        };

    const payload: AnalyzeRequest = {
      llm,
      inputs: {
        jdText,
        ...(jdUrl ? { jdUrl } : {}),
        cvText,
        ...(profileText ? { profileText } : {}),
        targetRole,
        strictness,
        language,
        weights,
      },
    };

    try {
      const result = await callAnalyze(payload);
      setField('result', result);
    } catch (err) {
      setField('error', err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setField('isAnalyzing', false);
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={isAnalyzing}
        disabled={!canAnalyze}
        onClick={handleAnalyze}
      >
        {isAnalyzing ? 'Analyzing…' : 'Analyze & Score'}
      </Button>

      {error && (
        <ErrorState
          title="Analysis failed"
          description={error}
          {...(canAnalyze ? { retry: handleAnalyze } : {})}
          className="py-6"
        />
      )}
    </div>
  );
}
