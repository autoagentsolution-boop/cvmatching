'use client';

import { useEffect, useMemo, useState } from 'react';
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

  return <CvAnalyzeRender result={result} roleFit={roleFit} overall={overall} tier={tier} tierLabel={tierLabel} roleLabel={roleLabel} refactorItems={refactorItems} cvId={cvId} />;
}

function CvAnalyzeRender({
  result,
  roleFit,
  overall,
  tier,
  tierLabel,
  roleLabel,
  refactorItems,
  cvId,
}: {
  result: AnalysisResult;
  roleFit: ReturnType<typeof aggregateRoleFit>;
  overall: number;
  tier: ReturnType<typeof classifyFit>['tier'];
  tierLabel: string;
  roleLabel: string | undefined;
  refactorItems: CriticalRefactorItem[];
  cvId: string;
}) {
  const [showDeepDive, setShowDeepDive] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Hero score block — compact header + gauge + caption + CTA */}
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest px-5 py-6">
        <div className="flex w-full items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Overall Role Fit
          </span>
          {roleLabel && (
            <span className="rounded-full bg-surface-container-low px-2.5 py-0.5 text-label-sm font-medium text-on-surface">
              {roleLabel}
            </span>
          )}
        </div>
        <RoleFitGauge
          score={overall}
          tier={tier}
          tierLabel={tierLabel}
          caption={result.summary}
          className="border-0 bg-transparent p-0"
          cta={
            <a
              href={`/cv-analyze/${cvId}/refined`}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary hover:bg-primary/90 transition-colors"
            >
              Improve Fit →
            </a>
          }
        />
      </section>

      {/* 3 role-fit metrics — each in own card with subtle bg + clear hierarchy */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          <MetricBar label="Role" value={roleFit.role} accent="role" />
        </div>
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          <MetricBar label="Keyword Match" value={roleFit.keywordMatch} accent="keyword" />
        </div>
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
          <MetricBar label="Experience" value={roleFit.experience} accent="experience" />
        </div>
      </div>

      {/* Critical Refactors — neutral cards, severity via icon only */}
      <CriticalRefactorList items={refactorItems} />

      {/* 9-dim deep dive — collapsed by default so it doesn't dominate the page */}
      <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <button
          type="button"
          onClick={() => setShowDeepDive((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={showDeepDive}
        >
          <div className="flex flex-col">
            <span className="font-display text-title-md font-semibold text-on-surface">
              9-Dimension Deep Dive
            </span>
            <span className="text-label-sm text-on-surface-variant">
              Recruiter rubric breakdown — {showDeepDive ? 'click to hide' : 'click to show'}
            </span>
          </div>
          <span
            className={`material-symbols-outlined text-on-surface-variant transition-transform ${showDeepDive ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>
        {showDeepDive && (
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            {result.metrics.map((m) => (
              <MetricBar
                key={m.name}
                label={NINE_DIM_LABELS[m.name] ?? m.name}
                value={m.score}
                reason={m.reason}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
