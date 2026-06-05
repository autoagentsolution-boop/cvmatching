'use client';

import { MatchScoreBlock } from '@/features/results/match-score-block';
import { recomputeOverall } from '@/lib/scoring/recompute-overall';
import { useSourceData } from './use-source-resolver';

export function MatchScoreBlockAside() {
  const { result, weights } = useSourceData();

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
