import type { AnalysisResult, Decision, Weights } from '@/features/analyze/types';

const DECISION_LABELS: Record<Decision, string> = {
  strong: 'Strong Match',
  good: 'Good Fit',
  stretch: 'Stretch Candidate',
  low: 'Low Match',
};

const METRIC_KEYS: (keyof Weights)[] = [
  'coreSkill',
  'tool',
  'scope',
  'production',
  'domain',
  'evidence',
  'seniority',
  'impact',
  'communication',
];

export interface RecomputedScore {
  overallScore: number;
  decision: Decision;
  decisionLabel: string;
}

export function recomputeOverall(weights: Weights): RecomputedScore {
  const values = METRIC_KEYS.map((k) => weights[k]).filter((v) => Number.isFinite(v));
  const mean = values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
  const overallScore = Math.max(0, Math.min(100, Math.round(mean)));

  let decision: Decision;
  if (overallScore >= 75) decision = 'strong';
  else if (overallScore >= 55) decision = 'good';
  else if (overallScore >= 35) decision = 'stretch';
  else decision = 'low';

  return { overallScore, decision, decisionLabel: DECISION_LABELS[decision] };
}

export function hydrateWeightsFromResult(result: AnalysisResult): Weights {
  const byName = new Map(result.metrics.map((m) => [m.name, m.score]));
  const out = {} as Weights;
  for (const k of METRIC_KEYS) {
    out[k] = byName.get(k) ?? 0;
  }
  return out;
}
