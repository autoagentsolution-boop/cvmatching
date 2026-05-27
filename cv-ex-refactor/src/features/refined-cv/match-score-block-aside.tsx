'use client';

import { useAnalysis } from '@/features/analyze/analysis-store';
import { MatchScoreBlock } from '@/features/results/match-score-block';
import { recomputeOverall } from '@/lib/scoring/recompute-overall';

export function MatchScoreBlockAside() {
  const result = useAnalysis((s) => s.result);
  const weights = useAnalysis((s) => s.weights);

  if (!result) return null;

  const displayed = recomputeOverall(weights);

  return (
    <MatchScoreBlock
      score={displayed.overallScore}
      decision={displayed.decision}
      decisionLabel={displayed.decisionLabel}
      summary={result.summary}
      compact
    />
  );
}
