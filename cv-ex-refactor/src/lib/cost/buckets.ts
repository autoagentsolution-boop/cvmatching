export type CostBucket = 'job-recommend' | 'analyze' | 'career-path' | 'generate-cv';

export const COST_BUCKETS: readonly CostBucket[] = [
  'job-recommend',
  'analyze',
  'career-path',
  'generate-cv',
] as const;
