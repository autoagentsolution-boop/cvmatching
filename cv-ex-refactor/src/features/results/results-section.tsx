'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, ErrorState, LoadingState, PageHeader, Tabs } from '@/components/ui';
import { DetailPanelLayout as Layout } from '@/components/layouts';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { callGenerateCv, callGenerateCvV3 } from '@/features/analyze/api-client';
import { recomputeOverall } from '@/lib/scoring/recompute-overall';
import type { AnalysisResult, GenerateCvRequest } from '@/features/analyze/types';

/**
 * v0.4 helper: extract the analyze-findings payload the v3 refine prompt
 * needs from the existing AnalysisResult shape. Pure derivation — no LLM
 * call — so the refine prompt is anchored to the SAME analyze findings the
 * user is looking at on the result page (no drift).
 */
function buildV3Findings(result: AnalysisResult, role: string) {
  const strengths = result.strengths
    .map((s) => [s.title, s.evidence].filter(Boolean).join(' — '))
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const wordingGaps = result.gaps
    .filter((g) => g.type === 'wording')
    .map((g) => [g.title, g.recommendation, g.fixAction].filter(Boolean).join(' — '))
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const recommendations = result.recommendations
    .map((r) => [r.title, r.action].filter(Boolean).join(' — '))
    .filter((s) => s.length > 0)
    .slice(0, 8);
  // Dimensions scoring under 60 are the ones the refine prompt should focus on.
  const weakDimensions = result.metrics
    .filter((m) => m.score < 60)
    .map((m) => m.name)
    .slice(0, 9);
  return {
    role: role || result.detectedRole || 'Target role',
    strengths,
    wordingGaps,
    recommendations,
    ...(result.suggestedSummaryLine ? { suggestedSummaryLine: result.suggestedSummaryLine } : {}),
    weakDimensions,
  };
}
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
    jdText, profileText, language, targetRoleConfirmed, inferredRole, setField,
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
  // v0.4: when user has a v3 analyze result (no jdText), the "Generate
  // refined CV" CTA routes to /api/generate-cv with the v3 body shape
  // (`findings` instead of `jdText`). The server prompt rewrites the CV
  // optimised for the candidate's claimed role using the analyze findings,
  // then RefinedCvView renders + JobFitCtaSection offers "find jobs with
  // this refined CV" as the next step (Analyze → Refined → Job Fit chain).
  const hasJd = jdText.trim().length > 0;
  const canGenerateV2 = hasJd;
  const canGenerateV3 = !hasJd && !!targetRoleConfirmed;

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
      // Keep Job Fit's CV view in sync after a role-override re-analyze too.
      try { sessionStorage.setItem('refined-cv-text:v1', cvText); } catch {
        // best-effort
      }
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

    try {
      let markdown: string;
      let refineNotes: string | null;

      if (hasJd) {
        // Legacy v2 CV-vs-JD path.
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
        const res = await callGenerateCv(payload);
        markdown = res.markdown;
        refineNotes = res.refineNotes;
      } else {
        // v0.4 CV-Solo path — derive findings from the analyze result.
        const findings = buildV3Findings(result, targetRoleConfirmed ?? '');
        const trimmedProfile = profileText.trim();
        const res = await callGenerateCvV3({
          llm,
          cvText: useAnalysis.getState().cvText,
          language,
          findings,
          ...(trimmedProfile ? { profileText: trimmedProfile } : {}),
        });
        markdown = res.markdown;
        refineNotes = res.refineNotes;
      }

      setField('matchedCv', markdown);
      setField('refineNotes', refineNotes);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate CV.');
    } finally {
      setField('isGeneratingCv', false);
    }
  }

  // v0.4 chain: Analyze → Refined CV (CV-solo polish for inferred role)
  //             → Job Fit (uses the refined CV).
  // If matched CV already generated → "Mở Refined CV". Otherwise generate
  // (v3 by default, v2 legacy when jdText is present).
  const headerAction = matchedCv ? (
    <Button variant="primary" size="sm" asChild>
      <Link href="/refined-cv">Mở Refined CV →</Link>
    </Button>
  ) : (canGenerateV2 || canGenerateV3) ? (
    <Button variant="primary" size="sm" loading={isGeneratingCv} onClick={handleGenerateCv}>
      {isGeneratingCv ? 'Đang tạo…' : 'Generate refined CV'}
    </Button>
  ) : (
    <Button variant="primary" size="sm" asChild>
      <Link href="/job-fit" aria-label="Đi tới Job Fit để tìm job phù hợp với CV này">
        Tìm job phù hợp →
      </Link>
    </Button>
  );

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
