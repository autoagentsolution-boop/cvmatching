// Tier-gate filter — anon/free/paid letter sets + count caps.
// Phase 4 of jobfit-db-pool-monetize.

import { describe, expect, it } from 'vitest';
import {
  allowedLettersForTier,
  applyTierGate,
  capForTier,
} from '@/lib/jobs/apply-tier-gate';
import type { TierLetter } from '@/lib/jobs/fit-tier';

function m(tier: TierLetter, jobId = `j-${tier}`) {
  return { tier, jobId };
}

describe('applyTierGate', () => {
  it('anon: 1 tier-B teaser, drops all others', () => {
    const out = applyTierGate(
      [m('S'), m('A'), m('B', 'b1'), m('B', 'b2'), m('C')],
      'anon',
    );
    expect(out).toEqual([m('B', 'b1')]);
  });

  it('free: up to 2 tier-B, drops S/A/C/D/E', () => {
    const out = applyTierGate(
      [m('S'), m('A'), m('B', 'b1'), m('B', 'b2'), m('B', 'b3'), m('C')],
      'free',
    );
    expect(out).toEqual([m('B', 'b1'), m('B', 'b2')]);
  });

  it('paid: all 6 letters allowed, cap at 10', () => {
    const all: TierLetter[] = ['S', 'A', 'A', 'A', 'B', 'B', 'C', 'C', 'D', 'E', 'E'];
    const matches = all.map((t, i) => m(t, `${t}-${i}`));
    const out = applyTierGate(matches, 'paid');
    expect(out.length).toBe(10);
    // Order preserved
    expect(out[0]!.tier).toBe('S');
  });

  it('preserves input order within allowed set', () => {
    const matches = [m('B', 'b1'), m('S'), m('B', 'b2')];
    expect(applyTierGate(matches, 'free')).toEqual([m('B', 'b1'), m('B', 'b2')]);
  });

  it('empty input → empty output for any tier', () => {
    expect(applyTierGate([], 'anon')).toEqual([]);
    expect(applyTierGate([], 'free')).toEqual([]);
    expect(applyTierGate([], 'paid')).toEqual([]);
  });

  it('all-disallowed input → empty output for free/anon', () => {
    expect(applyTierGate([m('S'), m('A'), m('C')], 'free')).toEqual([]);
    expect(applyTierGate([m('S'), m('A'), m('C')], 'anon')).toEqual([]);
  });

  it('allowedLettersForTier matches rule', () => {
    expect([...allowedLettersForTier('anon')].sort()).toEqual(['B']);
    expect([...allowedLettersForTier('free')].sort()).toEqual(['B']);
    expect([...allowedLettersForTier('paid')].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'S']);
  });

  it('capForTier matches rule', () => {
    expect(capForTier('anon')).toBe(1);
    expect(capForTier('free')).toBe(2);
    expect(capForTier('paid')).toBe(10);
  });
});
