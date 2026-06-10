'use client';

import { useEffect, useMemo, useState } from 'react';
import { MdAutoAwesome } from 'react-icons/md';
import { Button, Card, ErrorState, FormField, LoadingState, MarkdownView, Select } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { useJobFit } from '@/features/job-fit/job-fit-store';
import { JOB_FIT_CV_SESSION_KEY } from './use-source-resolver';
import type {
  CoverLetterBodyT,
  CoverLetterToneT,
  CoverLetterLengthT,
} from '@/lib/schemas/cover-letter-request';

const TONE_OPTIONS: SelectOption[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'warm', label: 'Warm' },
  { value: 'concise', label: 'Concise' },
  { value: 'leadership', label: 'Leadership' },
];

const LENGTH_OPTIONS: SelectOption[] = [
  { value: 'short', label: 'Short (150-200 words)' },
  { value: 'medium', label: 'Medium (250-400 words)' },
  { value: 'long', label: 'Long (400-550 words)' },
];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface CoverLetterResponse {
  markdown: string;
  quotaRemaining: number | null;
}

interface ApiErrorBody {
  ok?: false;
  error?: { code?: string; message?: string };
}

async function callCoverLetter(payload: CoverLetterBodyT): Promise<CoverLetterResponse> {
  const res = await fetch('/api/generate-cover-letter', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
    const msg = body?.error?.message ?? `Cover Letter thất bại (${res.status}).`;
    throw new Error(msg);
  }
  return (await res.json()) as CoverLetterResponse;
}

interface CoverLetterBlockProps {
  /** Explicit job id from the Job Fit detail mount — required as of 2026-06-05. */
  jobId: string;
}

// Mounted on /job-fit/[jobId] detail page only. Cover letter is bound to a
// specific job — without a jobId we have nothing to generate against, so
// the URL-fallback / refined-cv-aside path was removed.
// Pilot quota: 3/day for logged-in users (consume-quota.ts), 0 for anonymous.
export function CoverLetterBlock({ jobId }: CoverLetterBlockProps) {
  const { jobs } = useJobFit();
  const { language } = useAnalysis();
  // Most-recent analyze result — used to auto-prefill strengthsToLead +
  // (when checkbox on) gapToAddress. Falls back gracefully when no
  // analysis has run yet on this session.
  const analyzeResult = useAnalysis((s) => s.analyzeResult ?? s.jdMatchResult);

  const [tone, setTone] = useState<CoverLetterToneT>('professional');
  const [length, setLength] = useState<CoverLetterLengthT>('medium');
  const [addressGap, setAddressGap] = useState(false);

  const strengthsToLead = useMemo<string[] | undefined>(() => {
    const titles = analyzeResult?.strengths?.slice(0, 2).map((s) => s.title).filter(Boolean) ?? [];
    return titles.length > 0 ? titles : undefined;
  }, [analyzeResult]);

  const gapToAddress = useMemo<string | undefined>(() => {
    if (!addressGap || !analyzeResult) return undefined;
    const critical = analyzeResult.gaps.find((g) => g.severity === 'critical');
    return critical?.title || undefined;
  }, [addressGap, analyzeResult]);

  // Job Fit context CV — sessionStorage bridge written by Analyze /
  // JD-Matching on completion. Per-source store slots aren't reachable here
  // since CoverLetterBlock has no `?from=` URL.
  const [cvText, setCvText] = useState('');
  useEffect(() => {
    try {
      setCvText(window.sessionStorage.getItem(JOB_FIT_CV_SESSION_KEY) ?? '');
    } catch {
      setCvText('');
    }
  }, []);
  const { provider, model, temperature, baseUrl } = useSettings();

  const [markdown, setMarkdown] = useState<string | null>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const job = jobs.find((j) => j.jobId === jobId) ?? null;
  const hasCv = cvText.trim().length >= 50;
  const canGenerate = Boolean(job && hasCv);

  async function handleGenerate() {
    if (!job || !hasCv) return;
    setError(null);
    setIsLoading(true);
    const payload: CoverLetterBodyT = {
      llm: {
        provider,
        model,
        temperature,
        ...(baseUrl ? { baseUrl } : {}),
      },
      inputs: {
        cvText,
        jdText: job.description,
        jobTitle: job.title,
        company: job.company,
        language,
        tone,
        length,
        ...(strengthsToLead ? { strengthsToLead } : {}),
        ...(gapToAddress ? { gapToAddress } : {}),
      },
    };
    try {
      const res = await callCoverLetter(payload);
      setMarkdown(res.markdown);
      setQuota(res.quotaRemaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cover Letter thất bại.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div id="cover-letter">
    <Card padding="md" className="flex flex-col gap-3 bg-primary-container">
      <header className="flex items-center gap-2">
        <MdAutoAwesome size={18} className="text-on-primary-container" aria-hidden="true" />
        <h3 className="text-label-md font-bold text-on-primary-container">Generate Cover Letter</h3>
      </header>

      {!canGenerate && (
        <p className="text-label-sm text-on-primary-container/80 leading-relaxed">
          {!hasCv
            ? 'Cần CV trong phiên — chạy Analyze trước.'
            : 'Phiên job không còn — quay lại /job-fit và click vào job này từ list để nạp lại context.'}
        </p>
      )}

      {canGenerate && (
        <>
          <p className="text-label-sm text-on-primary-container/80 leading-relaxed">
            AI viết cover letter cho{' '}
            <strong className="font-bold">{job?.title}</strong>{' '}
            @ <strong className="font-bold">{job?.company}</strong>. Quota: 3 lần / ngày.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Tone" htmlFor="cover-tone">
              <Select
                id="cover-tone"
                options={TONE_OPTIONS}
                value={tone}
                onChange={(e) => setTone(e.target.value as CoverLetterToneT)}
                disabled={isLoading}
              />
            </FormField>
            <FormField label="Length" htmlFor="cover-length">
              <Select
                id="cover-length"
                options={LENGTH_OPTIONS}
                value={length}
                onChange={(e) => setLength(e.target.value as CoverLetterLengthT)}
                disabled={isLoading}
              />
            </FormField>
          </div>

          {analyzeResult && (
            <label className="flex items-center gap-2 text-label-sm text-on-primary-container/80">
              <input
                type="checkbox"
                checked={addressGap}
                onChange={(e) => setAddressGap(e.target.checked)}
                disabled={isLoading}
                className="rounded border-on-primary-container/40"
              />
              <span>Address top critical gap from analysis (1 sentence near the close)</span>
            </label>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              loading={isLoading}
              disabled={isLoading}
            >
              {markdown ? 'Generate lại' : 'Generate'}
            </Button>
            {quota != null && (
              <span className="text-xs text-on-primary-container/70">Còn {quota} lần hôm nay</span>
            )}
          </div>
        </>
      )}

      {isLoading && (
        <LoadingState variant="skeleton" lines={6} message="Đang viết cover letter..." />
      )}

      {error && !isLoading && (
        <ErrorState title="Cover Letter thất bại" description={error} retry={handleGenerate} />
      )}

      {markdown && !isLoading && !error && (
        <div className="rounded-lg bg-surface-container-lowest p-4">
          <MarkdownView markdown={markdown} variant="document" />
        </div>
      )}
    </Card>
    </div>
  );
}
