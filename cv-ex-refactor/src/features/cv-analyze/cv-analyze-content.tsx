'use client';

import { useEffect, useMemo } from 'react';
import {
  Button,
  ErrorState,
  LoadingState,
  RoleFitGauge,
  MetricBar,
  CriticalRefactorList,
  type CriticalRefactorItem,
} from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { callAnalyzeV3, isNeedsRoleConfirm } from '@/features/analyze/api-client';
import { hydrateWeightsFromResult } from '@/lib/scoring/recompute-overall';
import { aggregateRoleFit, classifyFit } from '@/lib/scoring/role-fit-aggregate';
import { isTransientLlmError } from '@/lib/llm/humanize-error';
import type { AnalyzeRequestLLM, AnalysisResult } from '@/features/analyze/types';

const NINE_DIM_LABELS: Record<string, string> = {
  coreSkill: 'Core Skills',
  tool: 'Tools',
  scope: 'Scope',
  production: 'Production',
  domain: 'Domain',
  evidence: 'Evidence',
  seniority: 'Seniority',
  impact: 'Impact',
  communication: 'Communication',
};

export interface CvAnalyzeContentProps {
  /** CV body loaded server-side from user_cvs. Seeds the analyze store. */
  cvContent: string;
  cvId: string;
}

/**
 * Right-column content for /cv-analyze/[cvId]/score.
 * Shares analysis-store with existing AnalyzePage (no duplicate state).
 */
export function CvAnalyzeContent({ cvContent, cvId }: CvAnalyzeContentProps) {
  const result = useAnalysis((s) => s.analyzeResult);
  const isAnalyzing = useAnalysis((s) => s.isAnalyzing);
  const error = useAnalysis((s) => s.error);
  const profileText = useAnalysis((s) => s.profileText);
  const language = useAnalysis((s) => s.language);
  const inferredRole = useAnalysis((s) => s.inferredRole);
  const targetRoleConfirmed = useAnalysis((s) => s.targetRoleConfirmed);
  const setField = useAnalysis((s) => s.setField);
  const { provider, model, temperature, baseUrl } = useSettings();

  // Seed store with CV content when the active CV changes.
  useEffect(() => {
    setField('analyzeCvText', cvContent);
  }, [cvContent, setField]);

  async function runAnalyze() {
    setField('error', null);
    setField('isAnalyzing', true);
    setField('analyzeResult', null);
    setField('targetRoleConfirmed', null);
    setField('inferredRole', null);

    const llm: AnalyzeRequestLLM = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
    };

    try {
      const response = await callAnalyzeV3({
        cvText: cvContent.trim(),
        llm,
        language,
        ...(profileText.trim() ? { profileText: profileText.trim() } : {}),
      });

      if (isNeedsRoleConfirm(response)) {
        setField('awaitingRoleConfirm', true);
        setField('roleCandidates', response.candidates);
        return;
      }
      setField('analyzeResult', response);
      setField('targetRoleConfirmed', response.targetRole);
      if (response.inferredRole) setField('inferredRole', response.inferredRole);
      setField('analyzeWeights', hydrateWeightsFromResult(response));
      setField('activeResultSource', 'analyze');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setField('error', message);
    } finally {
      setField('isAnalyzing', false);
    }
  }

  // Two error tiers — soft banner for transient (provider overload / rate
  // limit / network blip) so the page chrome stays usable, hard ErrorState
  // for non-recoverable failures. When a previous result is cached we keep
  // it on screen + show a dismissible banner on top.
  const transient = error ? isTransientLlmError(error) : false;
  if (error && !isAnalyzing && !transient) {
    return (
      <ErrorState
        title="Analysis failed"
        description={error}
        retry={runAnalyze}
      />
    );
  }

  if (isAnalyzing) {
    return <LoadingState variant="spinner" message="Analyzing your CV…" size="lg" />;
  }

  if (!result) {
    if (error && transient) {
      // Transient error without any cached result — friendly retry card.
      return (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-tertiary-container bg-tertiary-container/30 p-8 text-center">
          <p className="text-body-md text-on-tertiary-container">{error}</p>
          <Button variant="primary" size="md" onClick={runAnalyze}>Try again</Button>
        </section>
      );
    }
    return (
      <section className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-12 text-center">
        <div>
          <h2 className="font-display text-headline-md text-on-surface">Ready to analyze</h2>
          <p className="mt-2 max-w-md text-body-md text-on-surface-variant">
            We&apos;ll infer the target role from your CV and score it across 9 recruiter
            dimensions. No JD needed.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={runAnalyze} disabled={cvContent.trim().length < 100}>
          Analyze CV
        </Button>
        {cvContent.trim().length < 100 && (
          <p className="text-label-sm text-on-surface-variant/70">
            CV needs at least 100 characters.
          </p>
        )}
      </section>
    );
  }

  const inferredRoleLabel = inferredRole?.canonical ?? null;
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
      <CvAnalyzeResults result={result} inferredRole={inferredRoleLabel} targetRole={targetRoleConfirmed} cvId={cvId} />
    </>
  );
}

function CvAnalyzeResults({
  result,
  inferredRole,
  targetRole,
  cvId,
}: {
  result: AnalysisResult;
  inferredRole: string | null;
  targetRole: string | null;
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
  const roleLabel = result.detectedRole || targetRole || inferredRole || undefined;

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
        {...(roleLabel ? { roleLabel } : {})}
        caption={result.summary}
        cta={
          <a
            href={`/cv-analyze/${cvId}/refined`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90 transition-colors"
          >
            Improve Fit →
          </a>
        }
      />

      <section className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 sm:grid-cols-3">
        <MetricBar label="Role" value={roleFit.role} accent="role" />
        <MetricBar label="Keyword Match" value={roleFit.keywordMatch} accent="keyword" />
        <MetricBar label="Experience" value={roleFit.experience} accent="experience" />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <header className="flex items-baseline justify-between">
          <h3 className="font-display text-title-md font-semibold text-on-surface">9-Dim Deep Dive</h3>
          <span className="text-label-sm text-on-surface-variant">Recruiter rubric</span>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.metrics.map((m) => (
            <MetricBar
              key={m.name}
              label={NINE_DIM_LABELS[m.name] ?? m.name}
              value={m.score}
              reason={m.reason}
            />
          ))}
        </div>
      </section>

      <CriticalRefactorList items={refactorItems} />
    </div>
  );
}
