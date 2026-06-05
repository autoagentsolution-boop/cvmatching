'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Card, ErrorState } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { useJobFit } from '@/features/job-fit/job-fit-store';
import { callGenerateCv } from '@/features/analyze/api-client';
import type { CvMode, GenerateCvRequest } from '@/features/analyze/types';

const MODE_COPY: Record<CvMode, { label: string; verb: string; tone: string }> = {
  apply: {
    label: 'Apply',
    verb: 'Refine để apply ngay',
    tone: 'Polish CV cho fit cao — nhấn mạnh kinh nghiệm khớp JD.',
  },
  'fill-gaps': {
    label: 'Quick Fix',
    verb: 'Refine để bù gap',
    tone: 'Surface kinh nghiệm có thật để address requirement còn thiếu — không bịa.',
  },
  stretch: {
    label: 'Stretch',
    verb: 'Refine cho stretch apply',
    tone: 'Highlight transferable skills + growth — honest về gap còn lại.',
  },
};

function isCvMode(v: string | null): v is CvMode {
  return v === 'apply' || v === 'fill-gaps' || v === 'stretch';
}

// Client island: reads ?jobId&mode, surfaces a banner with click-to-generate.
// Renders null when no jobId/mode in URL — preserves the default /refined-cv flow.
// Auto-generate intentionally NOT wired: avoids burning a Gemini call on every
// link click; user explicitly confirms via the banner CTA.
export function RefinedCvModeBanner() {
  const params = useSearchParams();
  const jobId = params.get('jobId');
  const modeParam = params.get('mode');
  const mode = isCvMode(modeParam) ? modeParam : null;

  const { jobs } = useJobFit();
  const { cvText, language, profileText, isGeneratingCv, jobFitMatchedCv, setField } = useAnalysis();
  const matchedCv = jobFitMatchedCv;
  const { provider, model, temperature, baseUrl } = useSettings();

  const [localError, setLocalError] = useState<string | null>(null);

  if (!jobId || !mode) return null;

  const activeMode: CvMode = mode;
  const job = jobs.find((j) => j.jobId === jobId) ?? null;
  const copy = MODE_COPY[activeMode];

  if (!job) {
    return (
      <Card padding="md" className="border-l-4 border-l-amber-500">
        <p className="text-body-sm text-on-surface-variant">
          Không tìm thấy job <code className="font-mono text-xs">{jobId}</code> trong phiên hiện tại.
          Hãy quay lại{' '}
          <a href="/job-fit" className="text-primary underline">
            Job Fit
          </a>{' '}
          để chọn lại.
        </p>
      </Card>
    );
  }

  const synthesizedSummary =
    `Job: ${job.title} @ ${job.company}. Overall fit: ${job.overallScore}/100 (tier ${job.tier}).` +
    ` Top match reasons: ${job.matchReasons.slice(0, 3).join('; ')}.` +
    (job.studyTopics.length
      ? ` Suggested study topics: ${job.studyTopics
          .slice(0, 5)
          .map((t) => t.name)
          .join(', ')}.`
      : '');

  async function handleGenerate() {
    if (!job) return;
    setLocalError(null);
    setField('isGeneratingCv', true);
    const cvSource = cvText.trim().length >= 50 ? cvText : null;
    if (!cvSource) {
      setField('isGeneratingCv', false);
      setLocalError(
        'Không tìm thấy CV trong phiên hiện tại. Hãy chạy Analyze (paste CV) trước, rồi click Apply lại từ Job Fit.',
      );
      return;
    }

    const llm: GenerateCvRequest['llm'] = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
    };
    const payload: GenerateCvRequest = {
      llm,
      inputs: {
        jdText: job.description,
        cvText: cvSource,
        ...(profileText.trim() ? { profileText } : {}),
        language,
        tone: 'impact',
        length: 'medium',
        mode: activeMode,
      },
      analysisSummary: synthesizedSummary,
    };
    try {
      const { markdown, refineNotes } = await callGenerateCv(payload);
      setField('jobFitMatchedCv', markdown);
      setField('jobFitRefineNotes', refineNotes);
      setField('activeResultSource', 'job-fit');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Refine thất bại.');
    } finally {
      setField('isGeneratingCv', false);
    }
  }

  const ctaLabel = matchedCv ? `Re-generate (${copy.label})` : copy.verb;

  return (
    <div className="flex flex-col gap-3">
      <Card padding="md" className="border-l-4 border-l-primary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-label-sm font-bold uppercase tracking-wide text-primary">
              Mode: {copy.label}
            </span>
            <p className="text-body-md font-semibold text-on-surface">
              {job.title}{' '}
              <span className="text-on-surface-variant">@ {job.company}</span>
            </p>
            <p className="text-body-sm text-on-surface-variant">{copy.tone}</p>
          </div>
          <Button variant="primary" size="md" onClick={handleGenerate} loading={isGeneratingCv}>
            {isGeneratingCv ? 'Đang refine...' : ctaLabel}
          </Button>
        </div>
      </Card>

      {localError && (
        <ErrorState title="Refine thất bại" description={localError} retry={handleGenerate} />
      )}
    </div>
  );
}
