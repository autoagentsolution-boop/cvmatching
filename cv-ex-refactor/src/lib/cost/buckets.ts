// Cost buckets correspond 1:1 to LLM-touching endpoints. Each has its own
// daily cumulative + kill-switch flag in KV. Caps come from guard.ts.
export type CostBucket =
  | 'job-recommend'
  | 'analyze'
  | 'career-path'
  | 'career-path-suggest'
  | 'generate-cv'
  | 'generate-cover-letter'
  | 'extract-must-haves'
  | 'company-enrich'
  | 'jd-insights';

export const COST_BUCKETS: readonly CostBucket[] = [
  'job-recommend',
  'analyze',
  'career-path',
  'career-path-suggest',
  'generate-cv',
  'generate-cover-letter',
  'extract-must-haves',
  'company-enrich',
  'jd-insights',
] as const;
