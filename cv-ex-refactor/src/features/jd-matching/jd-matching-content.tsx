'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  ErrorState,
  LoadingState,
  Textarea,
  RoleFitGauge,
  MetricBar,
  CriticalRefactorList,
  type CriticalRefactorItem,
} from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { callAnalyze } from '@/features/analyze/api-client';
import { callJdInsights } from './api-client';
import { aggregateRoleFit, classifyFit } from '@/lib/scoring/role-fit-aggregate';
import type {
  AnalyzeRequest,
  AnalyzeRequestLLM,
  AnalysisResult,
  AnalysisCoverage,
} from '@/features/analyze/types';
import type { JdInsights } from '@/lib/llm/normalize-jd-insights';

export interface JdMatchingContentProps {
  cvContent: string;
  cvId: string;
}

const COVERAGE_TONE: Record<AnalysisCoverage['status'], { dot: string; label: string }> = {
  match: { dot: 'bg-primary', label: 'Matched' },
  partial: { dot: 'bg-tertiary', label: 'Partial' },
  missing: { dot: 'bg-error', label: 'Missing' },
};

export function JdMatchingContent({ cvContent, cvId }: JdMatchingContentProps) {
  const result = useAnalysis((s) => s.jdMatchResult);
  const isAnalyzing = useAnalysis((s) => s.isAnalyzing);
  const error = useAnalysis((s) => s.error);
  const language = useAnalysis((s) => s.language);
  const setField = useAnalysis((s) => s.setField);
  const { provider, model, temperature, baseUrl } = useSettings();

  const [jdText, setJdText] = useState('');
  const [insights, setInsights] = useState<JdInsights | null>(null);

  // Seed CV into the v2 slot whenever the active CV changes.
  useEffect(() => {
    setField('jdMatchCvText', cvContent);
  }, [cvContent, setField]);

  async function runMatch() {
    const trimmedJd = jdText.trim();
    if (trimmedJd.length < 50) {
      setField('error', 'JD cần ít nhất 50 ký tự.');
      return;
    }
    setField('error', null);
    setField('isAnalyzing', true);
    setField('jdMatchResult', null);
    setInsights(null);

    const llm: AnalyzeRequestLLM = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
    };

    const analyzePayload: AnalyzeRequest = {
      llm,
      inputs: {
        jdText: trimmedJd,
        cvText: cvContent,
        targetRole: 'auto',
        strictness: 'balanced',
        language,
        mustHaves: [],
      },
    };

    try {
      const [analysis, insightsRes] = await Promise.allSettled([
        callAnalyze(analyzePayload),
        callJdInsights({ cvText: cvContent, jdText: trimmedJd, llm, language }),
      ]);

      if (analysis.status === 'rejected') {
        throw analysis.reason instanceof Error ? analysis.reason : new Error(String(analysis.reason));
      }
      setField('jdMatchResult', analysis.value);
      setField('activeResultSource', 'jd-matching');

      if (insightsRes.status === 'fulfilled') {
        setInsights(insightsRes.value);
      } else {
        // Non-fatal — insights are decorative; the core score still renders.
        console.warn('[jd-matching] insights failed:', insightsRes.reason);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setField('error', message);
    } finally {
      setField('isAnalyzing', false);
    }
  }

  // Single ErrorState wrapper — replaces multi-block error duplication.
  if (error && !isAnalyzing) {
    return (
      <ErrorState
        title="JD Matching failed"
        description={error}
        retry={runMatch}
      />
    );
  }

  if (isAnalyzing) {
    return <LoadingState variant="spinner" message="Matching CV vs JD…" size="lg" />;
  }

  if (!result) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-8">
        <div>
          <h2 className="font-display text-headline-md text-on-surface">Paste a job description</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            We&apos;ll score how strongly your CV aligns with this JD and pull out priority gaps.
          </p>
        </div>
        <Textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={10}
          placeholder="Paste the full job description here…"
          aria-label="Job description"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-label-sm text-on-surface-variant">
            {jdText.trim().length} / 50 min characters
          </span>
          <Button
            variant="primary"
            size="lg"
            onClick={runMatch}
            disabled={jdText.trim().length < 50}
          >
            Run Match
          </Button>
        </div>
      </section>
    );
  }

  return <JdMatchingResults result={result} insights={insights} cvId={cvId} />;
}

function JdMatchingResults({
  result,
  insights,
  cvId,
}: {
  result: AnalysisResult;
  insights: JdInsights | null;
  cvId: string;
}) {
  const roleFit = useMemo(
    () => aggregateRoleFit({
      metrics: result.metrics,
      atsKeyword: result.atsKeyword,
      keywordCoverage: result.keywordCoverage,
    }),
    [result],
  );
  const overall = result.overallScore;
  const { tier, label: tierLabel } = classifyFit(overall);
  const matched = result.coverage.filter((c) => c.status === 'match').length;
  const totalCoverage = result.coverage.length;

  const refactorItems: CriticalRefactorItem[] = useMemo(() => {
    const items: CriticalRefactorItem[] = [];
    let idx = 0;
    for (const gap of result.gaps) {
      items.push({
        id: `gap-${idx++}`,
        title: gap.title,
        description: gap.recommendation || gap.fixAction || '',
        severity: gap.severity,
      });
    }
    for (const rec of result.recommendations) {
      const sev = rec.priority === 'high' ? 'critical' : rec.priority === 'medium' ? 'moderate' : 'minor';
      items.push({
        id: `rec-${idx++}`,
        title: rec.title,
        description: rec.action,
        severity: sev,
      });
    }
    return items;
  }, [result]);

  return (
    <div className="flex flex-col gap-5">
      <RoleFitGauge
        score={overall}
        tier={tier}
        tierLabel={tierLabel}
        variant="jd-match"
        caption={result.summary}
        {...(result.detectedRole ? { roleLabel: result.detectedRole } : {})}
        cta={
          <a
            href={`/jd-matching/${cvId}/refined`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-tertiary px-4 py-2 text-label-md font-semibold text-on-tertiary hover:bg-tertiary/90 transition-colors"
          >
            Apply Auto-Refactor →
          </a>
        }
      />

      {insights && (insights.insightsParagraph || insights.priorityChips.length > 0) && (
        <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-tertiary-container/40 p-5">
          <header className="flex items-baseline justify-between">
            <h3 className="font-display text-title-md font-semibold text-on-tertiary-container">
              Recruiter Read
            </h3>
            <span className="text-label-sm text-on-surface-variant">Independent take</span>
          </header>
          {insights.insightsParagraph && (
            <p className="text-body-md text-on-surface leading-relaxed">{insights.insightsParagraph}</p>
          )}
          {insights.priorityChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {insights.priorityChips.map((chip, i) => (
                <span
                  key={i}
                  className="rounded-full bg-tertiary px-3 py-1 text-label-sm font-semibold text-on-tertiary"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 sm:grid-cols-3">
        <MetricBar label="Role" value={roleFit.role} accent="role" />
        <MetricBar label="Keyword Match" value={roleFit.keywordMatch} accent="keyword" />
        <MetricBar label="Experience" value={roleFit.experience} accent="experience" />
      </section>

      {totalCoverage > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
          <header className="flex items-baseline justify-between">
            <h3 className="font-display text-title-md font-semibold text-on-surface">
              Must-Have Requirements
            </h3>
            <span className="text-label-md font-semibold tabular-nums text-on-surface-variant">
              {matched}/{totalCoverage} Matched
            </span>
          </header>
          <ul className="flex flex-col gap-2">
            {result.coverage.map((c, i) => {
              const tone = COVERAGE_TONE[c.status];
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-surface-container-low p-3"
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-label={tone.label} />
                  <div className="flex-1 min-w-0">
                    <p className="text-label-md font-medium text-on-surface">{c.requirement}</p>
                    {c.evidence && (
                      <p className="mt-0.5 text-body-sm text-on-surface-variant leading-snug line-clamp-2">
                        {c.evidence}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <CriticalRefactorList items={refactorItems} heading="Gap Analysis" />
    </div>
  );
}
