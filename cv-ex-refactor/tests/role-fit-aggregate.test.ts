import { describe, it, expect } from 'vitest';
import { aggregateRoleFit, classifyFit } from '@/lib/scoring/role-fit-aggregate';
import type { AnalysisMetric } from '@/features/analyze/types';

function m(name: string, score: number): AnalysisMetric {
  return { name, score, weight: 100, reason: '' };
}

const FULL_METRICS: AnalysisMetric[] = [
  m('coreSkill', 80),
  m('tool', 60),
  m('scope', 70),
  m('production', 90),
  m('domain', 60),
  m('evidence', 75),
  m('seniority', 65),
  m('impact', 85),
  m('communication', 70),
];

describe('aggregateRoleFit', () => {
  it('averages role from coreSkill + scope + domain', () => {
    const r = aggregateRoleFit({ metrics: FULL_METRICS });
    expect(r.role).toBe(Math.round((80 + 70 + 60) / 3));
  });

  it('averages experience from seniority + production + impact', () => {
    const r = aggregateRoleFit({ metrics: FULL_METRICS });
    expect(r.experience).toBe(Math.round((65 + 90 + 85) / 3));
  });

  it('prefers atsKeyword over coverage ratio', () => {
    const r = aggregateRoleFit({
      metrics: FULL_METRICS,
      atsKeyword: 73,
      keywordCoverage: { matched: ['a'], partial: [], missing: ['b', 'c'] },
    });
    expect(r.keywordMatch).toBe(73);
  });

  it('falls back to coverage ratio when atsKeyword absent', () => {
    const r = aggregateRoleFit({
      metrics: FULL_METRICS,
      keywordCoverage: { matched: ['a', 'b'], partial: ['c'], missing: ['d'] },
    });
    // (2 + 0.5) / 4 * 100 = 62.5 → 63
    expect(r.keywordMatch).toBe(63);
  });

  it('falls back to coverage when atsKeyword is 0', () => {
    const r = aggregateRoleFit({
      metrics: FULL_METRICS,
      atsKeyword: 0,
      keywordCoverage: { matched: ['a'], partial: [], missing: [] },
    });
    expect(r.keywordMatch).toBe(100);
  });

  it('returns 0 when no inputs given', () => {
    const r = aggregateRoleFit({ metrics: [] });
    expect(r).toEqual({ role: 0, experience: 0, keywordMatch: 0 });
  });

  it('handles missing dim names gracefully', () => {
    const partial = [m('coreSkill', 80), m('scope', 60)];
    const r = aggregateRoleFit({ metrics: partial });
    expect(r.role).toBe(Math.round((80 + 60) / 2));
    expect(r.experience).toBe(0);
  });

  it('clamps to 0-100 range', () => {
    const bad = [m('coreSkill', 200), m('scope', -50), m('domain', 50)];
    const r = aggregateRoleFit({ metrics: bad });
    expect(r.role).toBeGreaterThanOrEqual(0);
    expect(r.role).toBeLessThanOrEqual(100);
  });

  it('returns 0 keywordMatch when coverage all-empty', () => {
    const r = aggregateRoleFit({
      metrics: FULL_METRICS,
      keywordCoverage: { matched: [], partial: [], missing: [] },
    });
    expect(r.keywordMatch).toBe(0);
  });
});

describe('classifyFit', () => {
  it('strong at >= 75', () => {
    expect(classifyFit(75).tier).toBe('strong');
    expect(classifyFit(100).tier).toBe('strong');
  });

  it('partial 55-74', () => {
    expect(classifyFit(55).tier).toBe('partial');
    expect(classifyFit(74).tier).toBe('partial');
  });

  it('stretch < 55', () => {
    expect(classifyFit(54).tier).toBe('stretch');
    expect(classifyFit(0).tier).toBe('stretch');
  });
});
