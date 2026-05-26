'use client';

import { useAnalysis } from '@/features/analyze/analysis-store';
import { MatchScoreBlock } from '@/features/results/match-score-block';

/**
 * Thin client wrapper that reads analysis result from the store
 * and renders MatchScoreBlock in compact mode for the Refined CV aside rail.
 */
export function MatchScoreBlockAside() {
  const result = useAnalysis((s) => s.result);

  if (!result) return null;

  return (
    <MatchScoreBlock
      score={result.overallScore}
      decision={result.decision}
      decisionLabel={result.decisionLabel}
      summary={result.summary}
      compact
    />
  );
}
