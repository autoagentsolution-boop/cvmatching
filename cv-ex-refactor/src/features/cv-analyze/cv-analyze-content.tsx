'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  ErrorState,
  LoadingState,
  RoleFitGauge,
  MetricBar,
  CriticalRefactorList,
  Slider,
  Tabs,
  type CriticalRefactorItem,
} from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { callAnalyzeV3, isNeedsRoleConfirm } from '@/features/analyze/api-client';
import { hydrateWeightsFromResult, recomputeOverall } from '@/lib/scoring/recompute-overall';
import { aggregateRoleFit, classifyFit } from '@/lib/scoring/role-fit-aggregate';
import { isTransientLlmError } from '@/lib/llm/humanize-error';
import type { AnalyzeRequestLLM, AnalysisResult, Weights } from '@/features/analyze/types';

const NINE_DIM_KEYS: (keyof Weights)[] = [
  'coreSkill', 'tool', 'scope', 'production', 'domain', 'evidence', 'seniority', 'impact', 'communication',
];

// Universal dim labels — internal keys stay (coreSkill/tool/production) for
// schema compat, display text is role-agnostic so a Sales / Marketing CV
// doesn't see "Production" or "Tool" as a tech-only signal.
const NINE_DIM_LABELS: Record<string, string> = {
  coreSkill: 'Core Competency',
  tool: 'Tools & Systems',
  scope: 'Ownership Scope',
  production: 'Execution & Delivery',
  domain: 'Industry / Domain',
  evidence: 'Evidence of Work',
  seniority: 'Seniority & Authority',
  impact: 'Impact & Outcomes',
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
  // Weights live in the store so slider overrides persist + drive recompute.
  const weights = useAnalysis((s) => s.analyzeWeights);
  const setField = useAnalysis((s) => s.setField);

  // recomputeOverall(weights) is the SOURCE OF TRUTH for the displayed score.
  // result.overallScore alone is the LLM's initial reading; once user nudges
  // a slider the displayed score must reflect their override.
  // Per memory feedback_scoring_ux_model: sliders ARE the LLM scores; user
  // can override → overall recomputes → strengths/gaps stay frozen.
  const recomputed = useMemo(() => recomputeOverall(weights), [weights]);
  const overall = recomputed.overallScore;

  // Build a synthetic metrics list off the live weights so the role-fit
  // aggregator and 3 hero metric cards reflect slider changes too.
  const liveMetrics = useMemo(
    () => NINE_DIM_KEYS.map((k) => {
      const original = result.metrics.find((m) => m.name === k);
      return {
        name: k as string,
        score: weights[k],
        weight: 100,
        reason: original?.reason ?? '',
      };
    }),
    [weights, result.metrics],
  );

  const roleFit = useMemo(
    () => aggregateRoleFit({
      metrics: liveMetrics,
      atsKeyword: result.atsKeyword,
      keywordCoverage: result.keywordCoverage,
    }),
    [liveMetrics, result.atsKeyword, result.keywordCoverage],
  );
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

  function setWeight(key: keyof Weights, value: number) {
    setField('analyzeWeights', { ...weights, [key]: value });
  }

  // Restore the LLM's per-dim scores. Lets the user undo slider tweaks
  // without re-running Analyze.
  function resetWeights() {
    setField('analyzeWeights', hydrateWeightsFromResult(result));
  }

  return (
    <CvAnalyzeRender
      result={result}
      weights={weights}
      onWeightChange={setWeight}
      onResetWeights={resetWeights}
      roleFit={roleFit}
      overall={overall}
      tier={tier}
      tierLabel={tierLabel}
      roleLabel={roleLabel}
      refactorItems={refactorItems}
      cvId={cvId}
    />
  );
}

function CvAnalyzeRender({
  result,
  weights,
  onWeightChange,
  onResetWeights,
  roleFit,
  overall,
  tier,
  tierLabel,
  roleLabel,
  refactorItems,
  cvId,
}: {
  result: AnalysisResult;
  weights: Weights;
  onWeightChange: (key: keyof Weights, value: number) => void;
  onResetWeights: () => void;
  roleFit: ReturnType<typeof aggregateRoleFit>;
  overall: number;
  tier: ReturnType<typeof classifyFit>['tier'];
  tierLabel: string;
  roleLabel: string | undefined;
  refactorItems: CriticalRefactorItem[];
  cvId: string;
}) {
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [activeRefactorTab, setActiveRefactorTab] = useState<'strengths' | 'gaps' | 'recs'>('gaps');

  // Build separate items per tab from the FROZEN LLM output (user slider
  // overrides recompute the score but never alter strengths/gaps/recs).
  const strengthItems: CriticalRefactorItem[] = result.strengths.map((s, i) => ({
    id: `str-${i}`,
    title: s.title,
    description: s.evidence || s.jdSignal || '',
    severity: 'minor',
  }));
  const gapItems: CriticalRefactorItem[] = result.gaps.map((g, i) => ({
    id: `gap-${i}`,
    title: g.title,
    description: g.recommendation || g.fixAction || '',
    severity: g.severity,
  }));
  const recItems: CriticalRefactorItem[] = result.recommendations.map((r, i) => ({
    id: `rec-${i}`,
    title: r.title,
    description: r.action,
    severity: r.priority === 'high' ? 'critical' : r.priority === 'medium' ? 'moderate' : 'minor',
  }));

  // refactorItems prop unused by render (3 tabs replace single list).
  void refactorItems;

  return (
    <div className="flex flex-col gap-4">
      {/* Hero score block */}
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
            // ?from=analyze keeps use-source-resolver pointing at the analyze
            // slot so the Refined CV view picks up the right result/weights.
            <a
              href={`/cv-analyze/${cvId}/refined?from=analyze`}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary hover:bg-primary/90 transition-colors"
            >
              Refined CV →
            </a>
          }
        />
      </section>

      {/* 3 role-fit metrics */}
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

      {/* 9-dim deep dive — adjustable sliders (collapsed by default).
          Sits above Critical Refactors because the score is the primary
          number the user iterates on; refactors are the next-step action. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowDeepDive((v) => !v)}
            className="flex flex-1 items-center justify-between gap-2 text-left"
            aria-expanded={showDeepDive}
          >
            <div className="flex flex-col">
              <span className="font-display text-title-md font-semibold text-on-surface">
                9-Dimension Deep Dive
              </span>
              <span className="text-label-sm text-on-surface-variant">
                Adjust per-dim scores — overall recomputes live (gaps / recs stay frozen)
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
            <button
              type="button"
              onClick={onResetWeights}
              className="ml-2 inline-flex items-center gap-1 rounded-md border border-outline-variant px-2.5 py-1 text-label-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
              title="Reset all sliders to the AI's original per-dim scores"
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">restart_alt</span>
              Reset to AI score
            </button>
          )}
        </div>
        {showDeepDive && (
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            {NINE_DIM_KEYS.map((key) => {
              const reason = result.metrics.find((m) => m.name === key)?.reason ?? '';
              return (
                <div key={key} className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
                  <Slider
                    label={NINE_DIM_LABELS[key] ?? key}
                    value={[weights[key]]}
                    onValueChange={(v) => onWeightChange(key, v[0] ?? 0)}
                    min={0}
                    max={100}
                    step={1}
                  />
                  {reason && (
                    <p className="text-body-sm text-on-surface-variant leading-snug line-clamp-2">
                      {reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Critical Refactors — 3-tab split (Strengths / Gaps / Recs).
          Sits after 9-dim because the score is the primary number; refactors
          are the suggested next actions. */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <Tabs
          tabs={[
            { id: 'strengths', label: `Strengths (${strengthItems.length})` },
            { id: 'gaps', label: `Gaps (${gapItems.length})` },
            { id: 'recs', label: `Recommendations (${recItems.length})` },
          ]}
          activeId={activeRefactorTab}
          onChange={(id) => setActiveRefactorTab(id as typeof activeRefactorTab)}
          variant="underline"
        >
          {activeRefactorTab === 'strengths' && (
            <CriticalRefactorList
              items={strengthItems}
              heading=""
              emptyMessage="No standout strengths surfaced — push for more concrete evidence in the CV."
              className="border-0 bg-transparent p-0"
            />
          )}
          {activeRefactorTab === 'gaps' && (
            <CriticalRefactorList
              items={gapItems}
              heading=""
              emptyMessage="No critical gaps detected. Solid baseline."
              className="border-0 bg-transparent p-0"
            />
          )}
          {activeRefactorTab === 'recs' && (
            <CriticalRefactorList
              items={recItems}
              heading=""
              emptyMessage="No follow-up recommendations."
              className="border-0 bg-transparent p-0"
            />
          )}
        </Tabs>
      </section>
    </div>
  );
}
