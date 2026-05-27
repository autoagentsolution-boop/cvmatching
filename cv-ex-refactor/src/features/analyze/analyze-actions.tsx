'use client';

import { Button, ErrorState } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { useSettings } from './settings-store';
import { callAnalyze } from './api-client';
import { hydrateWeightsFromResult } from '@/lib/scoring/recompute-overall';
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
    mustHaves,
    isAnalyzing,
    error,
    setField,
  } = useAnalysis();

  const { provider, model, temperature, baseUrl } = useSettings();

  const hasJd = jdText.trim().length > 0;
  const hasCv = cvText.trim().length > 0;
  const canAnalyze = hasJd && hasCv && !isAnalyzing;

  const disabledHint = isAnalyzing
    ? null
    : !hasJd && !hasCv
      ? 'Paste a JD and your CV to enable analysis.'
      : !hasJd
        ? 'Paste a Job Description to start.'
        : !hasCv
          ? 'Paste or upload your CV to start.'
          : null;

  async function handleAnalyze() {
    setField('error', null);
    setField('isAnalyzing', true);
    setField('result', null);

    const llm: AnalyzeRequest['llm'] = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
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
        mustHaves,
      },
    };

    try {
      const result = await callAnalyze(payload);
      setField('result', result);
      setField('weights', hydrateWeightsFromResult(result));
    } catch (err) {
      setField('error', err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setField('isAnalyzing', false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {error && (
        <ErrorState
          title="Analysis failed"
          description={error}
          {...(canAnalyze ? { retry: handleAnalyze } : {})}
          className="py-4 w-full"
        />
      )}

      <Button
        variant="primary"
        size="xl"
        loading={isAnalyzing}
        disabled={!canAnalyze}
        onClick={handleAnalyze}
        trailingIcon={
          <span className="material-symbols-outlined" aria-hidden="true">
            {isAnalyzing ? 'progress_activity' : 'rocket_launch'}
          </span>
        }
      >
        {isAnalyzing ? 'Calculating score…' : 'Analyze & Score'}
      </Button>

      {isAnalyzing ? null : disabledHint ? (
        <p className="text-label-sm text-on-surface-variant">{disabledHint}</p>
      ) : (
        <p className="text-label-sm text-on-surface-variant">
          Estimated processing time: 4–6 seconds
        </p>
      )}
    </div>
  );
}
