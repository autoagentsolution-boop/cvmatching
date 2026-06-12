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
  | 'jd-insights'
  // Interview Practice — BYOK-only v1; bucket reserved so a future shared-key
  // tier has its own kill-switch + daily cap independent of analyze/etc.
  | 'interview-gen'
  | 'interview-grade';

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
  'interview-gen',
  'interview-grade',
] as const;
