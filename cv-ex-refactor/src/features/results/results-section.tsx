'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, ErrorState, LoadingState, PageHeader, Tabs } from '@/components/ui';
import { DetailPanelLayout as Layout } from '@/components/layouts';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { callGenerateCv } from '@/features/analyze/api-client';
import { recomputeOverall } from '@/lib/scoring/recompute-overall';
import type { GenerateCvRequest } from '@/features/analyze/types';
import { KeywordCoverageBlock } from './keyword-coverage-block';
import { MatchScoreBlock } from './match-score-block';
import { OptimizationPathsBlock } from './optimization-paths-block';
import { RecommendationsBlock } from './recommendations-block';
import { RedFlagsSection } from '@/features/analyze/red-flags-section';
import { InferredRoleBanner } from '@/features/analyze/inferred-role-banner';
import { callAnalyzeV3, isNeedsRoleConfirm } from '@/features/analyze/api-client';
import { hydrateWeightsFromResult } from '@/lib/scoring/recompute-overall';

const TABS = [
  { id: 'optimization', label: 'Optimization Paths' },
  { id: 'keywords', label: 'Keyword Coverage' },
  { id: 'recommendations', label: 'Recommendations' },
];

export function ResultsSection() {
  const {
    result, weights, matchedCv, isAnalyzing, isGeneratingCv, error,
    jdText, targetRoleConfirmed, inferredRole, setField,
  } = useAnalysis();
  const { provider, model, temperature, baseUrl } = useSettings();
  const [activeTab, setActiveTab] = useState('optimization');
  const [genError, setGenError] = useState<string | null>(null);

  if (isAnalyzing) {
    return <LoadingState variant="spinner" message="Analyzing your fit..." size="lg" />;
  }

  if (error) {
    return <ErrorState title="Analysis failed" description={error} />;
  }

  if (!result) return null;

  const displayed = recomputeOverall(weights);
  // v0.4 Cover Letter generation lives on Job Fit detail (Phase 5) — this
  // page's "Generate refined CV" still uses /api/generate-cv which requires
  // jdText. When user is on the CV-solo v3 path (no jdText), hide the CTA so
  // they don't hit a confusing 400. Phase 5 reroutes the affordance entirely.
  const canGenerateRefinedCv = jdText.trim().length > 0;

  async function handleOverrideRole(newRole: string) {
    setField('isAnalyzing', true);
    setField('error', null);
    try {
      const llm = {
        provider, model, temperature,
        ...(baseUrl ? { baseUrl } : {}),
      };
      const cvText = useAnalysis.getState().cvText.trim();
      const language = useAnalysis.getState().language;
      const profileText = useAnalysis.getState().profileText.trim();
      const response = await callAnalyzeV3({
        cvText, llm, language, role: newRole,
        ...(profileText ? { profileText } : {}),
      });
      if (isNeedsRoleConfirm(response)) {
        setField('awaitingRoleConfirm', true);
        setField('roleCandidates', response.candidates);
        return;
      }
      setField('result', response);
      setField('targetRoleConfirmed', response.targetRole);
      if (response.inferredRole) setField('inferredRole', response.inferredRole);
      setField('weights', hydrateWeightsFromResult(response));
    } catch (err) {
      setField('error', err instanceof Error ? err.message : 'Phân tích lại thất bại.');
    } finally {
      setField('isAnalyzing', false);
    }
  }

  async function handleGenerateCv() {
    if (!result) return;
    setGenError(null);
    setField('isGeneratingCv', true);

    const llm: GenerateCvRequest['llm'] = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
    };

    const payload: GenerateCvRequest = {
      llm,
      inputs: {
        jdText: useAnalysis.getState().jdText,
        cvText: useAnalysis.getState().cvText,
        language: useAnalysis.getState().language,
        tone: 'impact',
        length: 'medium',
      },
      analysisSummary: result.summary,
    };

    try {
      const { markdown, refineNotes } = await callGenerateCv(payload);
      setField('matchedCv', markdown);
      setField('refineNotes', refineNotes);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate CV.');
    } finally {
      setField('isGeneratingCv', false);
    }
  }

  const headerAction = matchedCv ? (
    <Button variant="primary" size="sm" asChild>
      <Link href="/refined-cv">Open refined CV</Link>
    </Button>
  ) : canGenerateRefinedCv ? (
    <Button variant="primary" size="sm" loading={isGeneratingCv} onClick={handleGenerateCv}>
      {isGeneratingCv ? 'Generating…' : 'Generate refined CV'}
    </Button>
  ) : null;

  return (
    <section className="mt-10 border-t border-outline-variant pt-10">
      <Layout
        header={
          <PageHeader
            title="Results"
            {...(result.targetRoleLabel
              ? { subtitle: `Optimized for: ${result.targetRoleLabel}` }
              : {})}
            action={headerAction}
          />
        }
        asideSlot={
          <MatchScoreBlock
            score={displayed.overallScore}
            decision={displayed.decision}
            decisionLabel={displayed.decisionLabel}
            summary={result.summary}
          />
        }
        asideWidth="md"
      >
        {targetRoleConfirmed && (
          <div className="mb-6">
            <InferredRoleBanner
              role={targetRoleConfirmed}
              {...(inferredRole?.confidence !== undefined
                ? { confidence: inferredRole.confidence }
                : {})}
              onOverride={handleOverrideRole}
              busy={isAnalyzing}
            />
          </div>
        )}

        {genError && (
          <ErrorState
            title="CV generation failed"
            description={genError}
            retry={handleGenerateCv}
            className="mb-6"
          />
        )}

        <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab}>
          {activeTab === 'optimization' && (
            <div className="mt-6">
              <OptimizationPathsBlock strengths={result.strengths} gaps={result.gaps} />
            </div>
          )}
          {activeTab === 'keywords' && (
            <div className="mt-6">
              <KeywordCoverageBlock keywordCoverage={result.keywordCoverage} />
            </div>
          )}
          {activeTab === 'recommendations' && (
            <div className="mt-6">
              <RecommendationsBlock recommendations={result.recommendations} />
            </div>
          )}
        </Tabs>

        {result.redFlags?.length > 0 && (
          <div className="mt-6">
            <RedFlagsSection redFlags={result.redFlags} />
          </div>
        )}
      </Layout>
    </section>
  );
}
