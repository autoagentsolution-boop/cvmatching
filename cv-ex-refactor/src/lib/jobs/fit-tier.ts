// Fit-tier classification for Wave A Job Recommend.
// Server-derives tier from overallScore — never trust an LLM-emitted tier field.
// Naming note: `TierLetter` to avoid collision with company-tier `Tier` in types.ts.

export type TierLetter = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

const SEMANTIC: Record<TierLetter, string> = {
  S: 'Strong Apply',
  A: 'Strong Apply',
  B: 'Apply After Quick Fix',
  C: 'Stretch Opportunity',
  D: 'Low Priority',
  E: 'Low Priority',
};

const TIER_ORDER: readonly TierLetter[] = ['S', 'A', 'B', 'C', 'D', 'E'] as const;

export const QUOTA: Record<TierLetter, number> = {
  S: 1,
  A: 3,
  B: 2,
  C: 2,
  D: 1,
  E: 1,
};

export function tierFromScore(score: number): TierLetter {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 55) return 'D';
  return 'E';
}

export function semanticForTier(t: TierLetter): string {
  return SEMANTIC[t];
}

// Caps each tier to QUOTA[tier]; preserves input order within a bucket so a
// pre-sorted (by overallScore desc) list still surfaces best-in-class first.
// Honest underfill: if a tier has fewer than its quota, returns what exists —
// never cross-fills from adjacent tiers.
export function enforceQuota<T extends { tier: TierLetter }>(matches: T[]): T[] {
  const buckets: Record<TierLetter, T[]> = { S: [], A: [], B: [], C: [], D: [], E: [] };
  for (const m of matches) buckets[m.tier].push(m);

  const result: T[] = [];
  for (const t of TIER_ORDER) {
    result.push(...buckets[t].slice(0, QUOTA[t]));
  }
  return result;
}
