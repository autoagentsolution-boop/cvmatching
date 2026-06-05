'use client';

import { Button, ErrorState } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { useSettings } from './settings-store';
import { callAnalyzeV3, isNeedsRoleConfirm } from './api-client';
import { RoleConfirmModal } from './role-confirm-modal';
import { hydrateWeightsFromResult } from '@/lib/scoring/recompute-overall';
import type { AnalyzeRequestLLM } from './types';

const MIN_CV_LEN = 100;

// v0.4 hotfix: Job Fit reads CV from this sessionStorage key (legacy contract
// from the v0.3 refined-cv → job-fit flow). In v0.4 there's no /refined-cv
// step in the analyze path, so the analyze handler writes it directly so
// Job Fit can see the CV without a manual hand-off.
const JOB_FIT_CV_SESSION_KEY = 'refined-cv-text:v1';
function writeCvForJobFit(cvText: string): void {
  try {
    sessionStorage.setItem(JOB_FIT_CV_SESSION_KEY, cvText);
  } catch {
    // Quota / private mode — best-effort. Job Fit empty-state guides the
    // user if write fails.
  }
}

export function AnalyzeActions() {
  const {
    cvText,
    profileText,
    language,
    isAnalyzing,
    error,
    awaitingRoleConfirm,
    roleCandidates,
    setField,
  } = useAnalysis();

  const { provider, model, temperature, baseUrl } = useSettings();

  const trimmedCv = cvText.trim();
  const hasCv = trimmedCv.length >= MIN_CV_LEN;
  const canAnalyze = hasCv && !isAnalyzing;

  const disabledHint = isAnalyzing
    ? null
    : !cvText.trim()
      ? 'Dán hoặc tải CV của bạn để bắt đầu.'
      : !hasCv
        ? `CV cần ít nhất ${MIN_CV_LEN} ký tự để phân tích.`
        : null;

  async function runAnalyze(role?: string) {
    setField('error', null);
    setField('isAnalyzing', true);
    setField('analyzeResult', null);
    if (!role) {
      // Fresh analyze — clear any prior role-confirm state from a previous run.
      setField('targetRoleConfirmed', null);
      setField('inferredRole', null);
    }

    const llm: AnalyzeRequestLLM = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
    };

    try {
      const response = await callAnalyzeV3({
        cvText: trimmedCv,
        llm,
        language,
        ...(role ? { role } : {}),
        ...(profileText.trim() ? { profileText: profileText.trim() } : {}),
      });

      if (isNeedsRoleConfirm(response)) {
        setField('awaitingRoleConfirm', true);
        setField('roleCandidates', response.candidates);
        return;
      }

      // Success path — write to Analyze slot, mark Analyze as active source.
      setField('analyzeResult', response);
      setField('analyzeWeights', hydrateWeightsFromResult(response));
      setField('activeResultSource', 'analyze');
      setField('targetRoleConfirmed', response.targetRole);
      if (response.inferredRole) setField('inferredRole', response.inferredRole);
      setField('awaitingRoleConfirm', false);
      setField('roleCandidates', []);
      writeCvForJobFit(trimmedCv);
    } catch (err) {
      setField('error', err instanceof Error ? err.message : 'Phân tích thất bại.');
    } finally {
      setField('isAnalyzing', false);
    }
  }

  function handleConfirmRole(role: string) {
    setField('awaitingRoleConfirm', false);
    void runAnalyze(role);
  }

  function handleCloseModal() {
    setField('awaitingRoleConfirm', false);
    setField('roleCandidates', []);
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {error && (
        <ErrorState
          title="Phân tích thất bại"
          description={error}
          {...(canAnalyze ? { retry: () => void runAnalyze() } : {})}
          className="w-full py-4"
        />
      )}

      <Button
        variant="primary"
        size="xl"
        loading={isAnalyzing}
        disabled={!canAnalyze}
        onClick={() => void runAnalyze()}
        trailingIcon={
          <span className="material-symbols-outlined" aria-hidden="true">
            {isAnalyzing ? 'progress_activity' : 'rocket_launch'}
          </span>
        }
      >
        {isAnalyzing ? 'Đang chấm điểm…' : 'Phân tích CV'}
      </Button>

      {isAnalyzing ? null : disabledHint ? (
        <p className="text-label-sm text-on-surface-variant">{disabledHint}</p>
      ) : (
        <p className="text-label-sm text-on-surface-variant">Thời gian xử lý khoảng 4–6 giây</p>
      )}

      <RoleConfirmModal
        open={awaitingRoleConfirm}
        candidates={roleCandidates}
        onConfirm={handleConfirmRole}
        onClose={handleCloseModal}
        busy={isAnalyzing}
      />
    </div>
  );
}
