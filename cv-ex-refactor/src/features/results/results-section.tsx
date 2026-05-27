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
import { PredictiveInterviewStub } from './predictive-interview-stub';
import { RecommendationsBlock } from './recommendations-block';

const TABS = [
  { id: 'optimization', label: 'Optimization Paths' },
  { id: 'keywords', label: 'Keyword Coverage' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'interview', label: 'Interview Questions' },
];

export function ResultsSection() {
  const { result, weights, matchedCv, isAnalyzing, isGeneratingCv, error, setField } = useAnalysis();
  const { useSharedKey, provider, model, temperature, baseUrl, apiKey } = useSettings();
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

  async function handleGenerateCv() {
    if (!result) return;
    setGenError(null);
    setField('isGeneratingCv', true);

    const llm: GenerateCvRequest['llm'] = useSharedKey
      ? { provider, model, temperature }
      : {
          provider,
          model,
          temperature,
          ...(baseUrl ? { baseUrl } : {}),
          ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}),
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
      const markdown = await callGenerateCv(payload);
      setField('matchedCv', markdown);
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
  ) : (
    <Button variant="primary" size="sm" loading={isGeneratingCv} onClick={handleGenerateCv}>
      {isGeneratingCv ? 'Generating…' : 'Generate refined CV'}
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
          {activeTab === 'interview' && (
            <div className="mt-6">
              <PredictiveInterviewStub />
            </div>
          )}
        </Tabs>
      </Layout>
    </section>
  );
}
