'use client';

import { Button, ErrorState } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { useSettings } from './settings-store';
import { callAnalyzeV3, isNeedsRoleConfirm } from './api-client';
import { RoleConfirmModal } from './role-confirm-modal';
import { hydrateWeightsFromResult } from '@/lib/scoring/recompute-overall';
import type { AnalyzeRequestLLM } from './types';

const MIN_CV_LEN = 100;

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
    setField('result', null);
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

      // Success path
      setField('result', response);
      setField('targetRoleConfirmed', response.targetRole);
      if (response.inferredRole) setField('inferredRole', response.inferredRole);
      setField('weights', hydrateWeightsFromResult(response));
      setField('awaitingRoleConfirm', false);
      setField('roleCandidates', []);
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
