'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  MdArrowUpward,
  MdCheckCircle,
  MdCancel,
  MdRemoveCircleOutline,
} from 'react-icons/md';
import {
  Button,
  ErrorState,
  LoadingState,
  RoleFitGauge,
  MetricBar,
  CriticalRefactorList,
  type CriticalRefactorItem,
} from '@/components/ui';
import { scrollToSource } from '@/lib/scroll-to-source';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { callAnalyze } from '@/features/analyze/api-client';
import { callJdInsights } from './api-client';
import { JdImportPanel } from './jd-import-panel';
import { aggregateRoleFit, classifyFit } from '@/lib/scoring/role-fit-aggregate';
import { hydrateWeightsFromResult, recomputeOverall } from '@/lib/scoring/recompute-overall';
import { isTransientLlmError } from '@/lib/llm/humanize-error';
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

interface CoverageVisual {
  Icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  iconColor: string;
  label: string;
}

// Match = green check; missing = red cross; partial = amber dash. Icons
// communicate status faster than colored dots — at a glance the user
// counts ticks vs crosses without parsing a legend.
const COVERAGE_VISUAL: Record<AnalysisCoverage['status'], CoverageVisual> = {
  match: { Icon: MdCheckCircle, iconColor: 'text-success', label: 'Matched' },
  partial: { Icon: MdRemoveCircleOutline, iconColor: 'text-warning', label: 'Partial' },
  missing: { Icon: MdCancel, iconColor: 'text-error', label: 'Missing' },
};

export function JdMatchingContent({ cvContent, cvId }: JdMatchingContentProps) {
  const result = useAnalysis((s) => s.jdMatchResult);
  const isAnalyzing = useAnalysis((s) => s.isAnalyzing);
  const error = useAnalysis((s) => s.error);
  const language = useAnalysis((s) => s.language);
  const jdText = useAnalysis((s) => s.jdText);
  const setField = useAnalysis((s) => s.setField);
  const { provider, model, temperature, baseUrl } = useSettings();

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

  // Transient (5xx/429/timeout) → soft retry card. Hard → full ErrorState.
  const transient = error ? isTransientLlmError(error) : false;
  if (error && !isAnalyzing && !transient) {
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
      <section className="flex flex-col gap-5 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-8">
        <div>
          <h2 className="font-display text-headline-md text-on-surface">Ready to match CV vs JD</h2>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Bring in a job description by pasting it, fetching a posting URL, or uploading a PDF/Word file.
            We&apos;ll compare it against your CV across 9 recruiter dimensions and surface the priority gaps to close.
          </p>
        </div>

        <JdImportPanel />

        <div className="flex items-center justify-end gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={runMatch}
            disabled={jdText.trim().length < 50}
          >
            Match CV vs JD
          </Button>
        </div>
      </section>
    );
  }

  return (
    <>
      {error && transient && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-tertiary-container bg-tertiary-container/40 px-4 py-3">
          <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5" aria-hidden="true">info</span>
          <div className="flex-1 text-body-sm text-on-tertiary-container">{error}</div>
          <button
            type="button"
            onClick={() => setField('error', null)}
            className="text-label-sm font-semibold text-on-tertiary-container/70 hover:text-on-tertiary-container"
          >
            Dismiss
          </button>
        </div>
      )}
      <JdMatchingResults result={result} insights={insights} cvId={cvId} />
    </>
  );
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
  // The analyze prompt instructs the LLM NOT to emit overallScore (rule
  // #11 — client computes it from the 9 dim scores). Mirror v3's pattern:
  // derive weights from result.metrics then recomputeOverall. Falls back
  // to result.overallScore only when metrics are empty so legacy cached
  // responses still render a non-zero gauge.
  const overall = useMemo(() => {
    const recomputed = recomputeOverall(hydrateWeightsFromResult(result));
    return recomputed.overallScore > 0 ? recomputed.overallScore : result.overallScore;
  }, [result]);
  const { tier, label: tierLabel } = classifyFit(overall);
  const matched = result.coverage.filter((c) => c.status === 'match').length;
  const totalCoverage = result.coverage.length;

  const refactorItems: CriticalRefactorItem[] = useMemo(() => {
    const items: CriticalRefactorItem[] = [];
    let idx = 0;
    // Each finding routes back to the JD card — that's where the requirement
    // context lives; user wants to re-read the source to confirm the gap.
    for (const gap of result.gaps) {
      items.push({
        id: `gap-${idx++}`,
        title: gap.title,
        description: gap.recommendation || gap.fixAction || '',
        severity: gap.severity,
        ctaLabel: 'Show in JD',
        onCta: () => scrollToSource('jd'),
      });
    }
    for (const rec of result.recommendations) {
      const sev = rec.priority === 'high' ? 'critical' : rec.priority === 'medium' ? 'moderate' : 'minor';
      items.push({
        id: `rec-${idx++}`,
        title: rec.title,
        description: rec.action,
        severity: sev,
        ctaLabel: 'Show in JD',
        onCta: () => scrollToSource('jd'),
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
              const visual = COVERAGE_VISUAL[c.status];
              const VisualIcon = visual.Icon;
              return (
                <li
                  key={i}
                  className="group flex items-start gap-3 rounded-xl bg-surface-container-low p-3"
                >
                  <VisualIcon
                    size={20}
                    className={`mt-0.5 shrink-0 ${visual.iconColor}`}
                    aria-hidden={true}
                  />
                  <span className="sr-only">{visual.label}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-label-md font-medium text-on-surface">{c.requirement}</p>
                    {c.evidence && (
                      <p className="mt-0.5 text-body-sm text-on-surface-variant leading-snug line-clamp-2">
                        {c.evidence}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollToSource('jd')}
                    aria-label={`Find "${c.requirement}" in source JD`}
                    title="Find in source JD"
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-on-surface-variant opacity-0 transition-all hover:bg-surface-container-high hover:text-on-surface focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover:opacity-100"
                  >
                    <MdArrowUpward size={16} aria-hidden="true" />
                  </button>
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
