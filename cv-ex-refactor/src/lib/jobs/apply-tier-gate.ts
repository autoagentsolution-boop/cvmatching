// Tier-gating filter for the Job Fit recommend response.
//
// Applied AFTER `enforceQuota` from fit-tier.ts. The quota step caps each fit
// tier (S/A/B/C/D/E) by its existing per-tier limit; this gate then narrows
// to the LETTER set allowed for the user's TIER (anon/free/paid) and applies
// a count CAP per the monetization rule.
//
// Locked rule (from plan.md and user 2026-06-06):
//   anon → 1 job, tier B only (teaser)
//   free → 2 jobs, tier B only
//   paid → 10 jobs, all 6 letters (S/A/B/C/D/E)
//
// Pure function — no side effects, no DB. Easy unit-test surface.

import type { TierLetter } from './fit-tier';
import type { UserTier } from '../users/resolve-user-tier';

interface HasTier { tier: TierLetter }

const ALLOWED_LETTERS: Record<UserTier, ReadonlySet<TierLetter>> = {
  anon: new Set<TierLetter>(['B']),
  free: new Set<TierLetter>(['B']),
  paid: new Set<TierLetter>(['S', 'A', 'B', 'C', 'D', 'E']),
};

const CAP: Record<UserTier, number> = {
  anon: 1,
  free: 2,
  paid: 10,
};

/**
 * Filter matches by allowed letters for the user's tier, then cap by count.
 * Input order is preserved (callers should pre-sort by overallScore desc so
 * the best-in-class survives the cap).
 */
export function applyTierGate<T extends HasTier>(matches: T[], tier: UserTier): T[] {
  const allowed = ALLOWED_LETTERS[tier];
  const cap = CAP[tier];
  const filtered: T[] = [];
  for (const m of matches) {
    if (!allowed.has(m.tier)) continue;
    filtered.push(m);
    if (filtered.length >= cap) break;
  }
  return filtered;
}

/** Exported for callers / tests that need to introspect the rule. */
export function allowedLettersForTier(tier: UserTier): ReadonlySet<TierLetter> {
  return ALLOWED_LETTERS[tier];
}

export function capForTier(tier: UserTier): number {
  return CAP[tier];
}
