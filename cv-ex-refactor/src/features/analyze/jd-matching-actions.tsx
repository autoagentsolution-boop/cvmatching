'use client';

import { Button, ErrorState } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { useSettings } from './settings-store';
import { callAnalyze } from './api-client';
import { hydrateWeightsFromResult } from '@/lib/scoring/recompute-overall';
import type { AnalyzeRequest, AnalyzeRequestLLM } from './types';

const MIN_CV_LEN = 100;
const MIN_JD_LEN = 80;

// Mirror the analyze-actions session contract — write CV so downstream
// Job Fit pre-fills without a manual hand-off, even though JD Matching is
// its own pipeline. Consistent UX across both analyze entry points.
const JOB_FIT_CV_SESSION_KEY = 'refined-cv-text:v1';
function writeCvForJobFit(cvText: string): void {
  try {
    sessionStorage.setItem(JOB_FIT_CV_SESSION_KEY, cvText);
  } catch {
    // Quota / private mode — best-effort.
  }
}

export function JdMatchingActions() {
  const {
    cvText,
    jdText,
    jdUrl,
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

  const trimmedCv = cvText.trim();
  const trimmedJd = jdText.trim();
  const hasCv = trimmedCv.length >= MIN_CV_LEN;
  const hasJd = trimmedJd.length >= MIN_JD_LEN;
  const canAnalyze = hasCv && hasJd && !isAnalyzing;

  const disabledHint = isAnalyzing
    ? null
    : !trimmedCv
      ? 'Dán hoặc tải CV của bạn để bắt đầu.'
      : !hasCv
        ? `CV cần ít nhất ${MIN_CV_LEN} ký tự.`
        : !trimmedJd
          ? 'Dán mô tả công việc (JD) để so khớp.'
          : !hasJd
            ? `JD cần ít nhất ${MIN_JD_LEN} ký tự.`
            : null;

  async function runMatch() {
    setField('error', null);
    setField('isAnalyzing', true);
    setField('jdMatchResult', null);

    const llm: AnalyzeRequestLLM = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
    };

    const payload: AnalyzeRequest = {
      llm,
      inputs: {
        jdText: trimmedJd,
        ...(jdUrl.trim() ? { jdUrl: jdUrl.trim() } : {}),
        cvText: trimmedCv,
        ...(profileText.trim() ? { profileText: profileText.trim() } : {}),
        targetRole,
        strictness,
        language,
        mustHaves,
      },
    };

    try {
      const response = await callAnalyze(payload);
      setField('jdMatchResult', response);
      setField('jdMatchWeights', hydrateWeightsFromResult(response));
      setField('activeResultSource', 'jd-matching');
      writeCvForJobFit(trimmedCv);
    } catch (err) {
      setField('error', err instanceof Error ? err.message : 'So khớp thất bại.');
    } finally {
      setField('isAnalyzing', false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {error && (
        <ErrorState
          title="So khớp thất bại"
          description={error}
          {...(canAnalyze ? { retry: () => void runMatch() } : {})}
          className="w-full py-4"
        />
      )}

      <Button
        variant="primary"
        size="xl"
        loading={isAnalyzing}
        disabled={!canAnalyze}
        onClick={() => void runMatch()}
        trailingIcon={
          <span className="material-symbols-outlined" aria-hidden="true">
            {isAnalyzing ? 'progress_activity' : 'compare_arrows'}
          </span>
        }
      >
        {isAnalyzing ? 'Đang so khớp…' : 'So khớp CV với JD'}
      </Button>

      {isAnalyzing ? null : disabledHint ? (
        <p className="text-label-sm text-on-surface-variant">{disabledHint}</p>
      ) : (
        <p className="text-label-sm text-on-surface-variant">Thời gian xử lý khoảng 5–8 giây</p>
      )}
    </div>
  );
}
