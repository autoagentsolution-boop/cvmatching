'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, ErrorState, LoadingState, PageHeader, Tabs } from '@/components/ui';
import { DetailPanelLayout as Layout } from '@/components/layouts';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { callGenerateCv, callGenerateCvV3 } from '@/features/analyze/api-client';
import { recomputeOverall } from '@/lib/scoring/recompute-overall';
import { buildV3Findings } from '@/features/analyze/build-v3-findings';
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

type ResultsSource = 'analyze' | 'jd-matching';

interface ResultsSectionProps {
  /** Which source's slot to read/write. analyze-page → 'analyze',
   *  jd-matching-page → 'jd-matching'. Drives per-source store namespacing
   *  + Generate CV dispatch (v3 vs v2) + Refined CV deep-link `?from=`. */
  source: ResultsSource;
}

export function ResultsSection({ source }: ResultsSectionProps) {
  // Per-source slot selection — same store, different keys per page.
  const isAnalyzeSource = source === 'analyze';
  const result = useAnalysis((s) => (isAnalyzeSource ? s.analyzeResult : s.jdMatchResult));
  const weights = useAnalysis((s) => (isAnalyzeSource ? s.analyzeWeights : s.jdMatchWeights));
  const matchedCv = useAnalysis((s) => (isAnalyzeSource ? s.analyzeMatchedCv : s.jdMatchMatchedCv));
  const { isAnalyzing, isGeneratingCv, error, profileText, language, targetRoleConfirmed, inferredRole, setField } =
    useAnalysis();
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
  // v0.4 Generate-CV dispatch is now driven by `source`, not jdText presence.
  // analyze-page (v3 CV-solo) → callGenerateCvV3 + findings derivation.
  // jd-matching-page (v2 CV-vs-JD) → callGenerateCv with jdText.
  const canGenerateV2 = !isAnalyzeSource;
  const canGenerateV3 = isAnalyzeSource && !!targetRoleConfirmed;
  const resultFieldKey: 'analyzeResult' | 'jdMatchResult' = isAnalyzeSource ? 'analyzeResult' : 'jdMatchResult';
  const weightsFieldKey: 'analyzeWeights' | 'jdMatchWeights' = isAnalyzeSource ? 'analyzeWeights' : 'jdMatchWeights';
  const matchedCvFieldKey: 'analyzeMatchedCv' | 'jdMatchMatchedCv' = isAnalyzeSource ? 'analyzeMatchedCv' : 'jdMatchMatchedCv';
  const refineNotesFieldKey: 'analyzeRefineNotes' | 'jdMatchRefineNotes' = isAnalyzeSource ? 'analyzeRefineNotes' : 'jdMatchRefineNotes';
  const refinedCvHref = `/refined-cv?from=${source}`;

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
      setField(resultFieldKey, response);
      setField('targetRoleConfirmed', response.targetRole);
      if (response.inferredRole) setField('inferredRole', response.inferredRole);
      setField(weightsFieldKey, hydrateWeightsFromResult(response));
      setField('activeResultSource', source);
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

      if (!isAnalyzeSource) {
        // JD Matching (v2) CV-vs-JD path.
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

      setField(matchedCvFieldKey, markdown);
      setField(refineNotesFieldKey, refineNotes);
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
      <Link href={refinedCvHref}>Mở Refined CV →</Link>
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
        {isAnalyzeSource && targetRoleConfirmed && (
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
