// Unit tests for alias-resolver — pure parse + threshold logic only.
// Orchestrator `resolveCompany` is integration-tested manually against KV +
// real Gemini via scripts/smoke-company-resolve.ts (separate; not CI-asserted).

import { describe, it, expect } from 'vitest';
import {
  parseRankingResponse,
  decideFromRanking,
  RankingSchema,
  type Ranking,
} from '@/lib/companies/alias-resolver';

describe('parseRankingResponse', () => {
  it('parses well-formed JSON', () => {
    const raw = JSON.stringify({
      rankings: [
        { slug: 'fpt-software', score: 0.97, reason: 'Same brand + suffix variant' },
      ],
    });
    expect(parseRankingResponse(raw)).toEqual({
      rankings: [{ slug: 'fpt-software', score: 0.97, reason: 'Same brand + suffix variant' }],
    });
  });

  it('parses JSON inside markdown fence', () => {
    const raw = '```json\n{"rankings":[{"slug":"a","score":0.5,"reason":"r"}]}\n```';
    const parsed = parseRankingResponse(raw);
    expect(parsed?.rankings).toHaveLength(1);
  });

  it('returns null on malformed JSON', () => {
    expect(parseRankingResponse('not json at all')).toBeNull();
    expect(parseRankingResponse('')).toBeNull();
  });

  it('returns null on JSON missing required fields', () => {
    expect(parseRankingResponse('{"rankings":[{"slug":"a"}]}')).toBeNull();
    expect(parseRankingResponse('{"rankings":[{"score":0.5,"reason":"r"}]}')).toBeNull();
  });

  it('returns null on score out of range', () => {
    const raw = JSON.stringify({
      rankings: [{ slug: 'a', score: 1.5, reason: 'r' }],
    });
    expect(parseRankingResponse(raw)).toBeNull();
  });

  it('caps array at 5 entries', () => {
    const sixEntries = JSON.stringify({
      rankings: Array.from({ length: 6 }, (_, i) => ({
        slug: `c-${i}`,
        score: 0.5,
        reason: 'r',
      })),
    });
    // Schema enforces max(5) — 6-entry response is rejected as invalid shape.
    expect(parseRankingResponse(sixEntries)).toBeNull();
  });

  it('accepts empty rankings array', () => {
    const raw = JSON.stringify({ rankings: [] });
    expect(parseRankingResponse(raw)).toEqual({ rankings: [] });
  });
});

describe('decideFromRanking — threshold gates', () => {
  const candidate = (score: number): Ranking => ({
    rankings: [{ slug: 'existing', score, reason: 'test' }],
  });

  it('≥0.95 → auto-merge', () => {
    const d = decideFromRanking(candidate(0.95));
    expect(d.kind).toBe('auto-merge');
    if (d.kind === 'auto-merge') {
      expect(d.candidate.slug).toBe('existing');
    }
  });

  it('0.97 → auto-merge', () => {
    expect(decideFromRanking(candidate(0.97)).kind).toBe('auto-merge');
  });

  it('1.0 → auto-merge', () => {
    expect(decideFromRanking(candidate(1.0)).kind).toBe('auto-merge');
  });

  it('0.94 just under merge threshold → queue', () => {
    expect(decideFromRanking(candidate(0.94)).kind).toBe('queue');
  });

  it('0.85 mid grey-zone → queue', () => {
    const d = decideFromRanking(candidate(0.85));
    expect(d.kind).toBe('queue');
    if (d.kind === 'queue') {
      expect(d.candidate.score).toBe(0.85);
    }
  });

  it('0.70 boundary → queue', () => {
    expect(decideFromRanking(candidate(0.7)).kind).toBe('queue');
  });

  it('0.69 just under queue threshold → mint-new', () => {
    expect(decideFromRanking(candidate(0.69)).kind).toBe('mint-new');
  });

  it('0.5 mid-range → mint-new', () => {
    expect(decideFromRanking(candidate(0.5)).kind).toBe('mint-new');
  });

  it('0.0 clearly different → mint-new', () => {
    expect(decideFromRanking(candidate(0.0)).kind).toBe('mint-new');
  });

  it('null ranking → mint-new', () => {
    expect(decideFromRanking(null).kind).toBe('mint-new');
  });

  it('empty rankings array → mint-new', () => {
    expect(decideFromRanking({ rankings: [] }).kind).toBe('mint-new');
  });

  it('uses only first ranking (highest expected to be first)', () => {
    const multi: Ranking = {
      rankings: [
        { slug: 'top', score: 0.96, reason: 'best' },
        { slug: 'second', score: 0.5, reason: 'second' },
      ],
    };
    const d = decideFromRanking(multi);
    expect(d.kind).toBe('auto-merge');
    if (d.kind === 'auto-merge') {
      expect(d.candidate.slug).toBe('top');
    }
  });
});

describe('RankingSchema', () => {
  it('rejects slug longer than 80 chars', () => {
    const raw = JSON.stringify({
      rankings: [{ slug: 'a'.repeat(81), score: 0.5, reason: 'r' }],
    });
    expect(parseRankingResponse(raw)).toBeNull();
  });

  it('rejects reason longer than 280 chars', () => {
    const raw = JSON.stringify({
      rankings: [{ slug: 'a', score: 0.5, reason: 'r'.repeat(281) }],
    });
    expect(parseRankingResponse(raw)).toBeNull();
  });

  it('rejects negative score', () => {
    const raw = JSON.stringify({
      rankings: [{ slug: 'a', score: -0.1, reason: 'r' }],
    });
    expect(parseRankingResponse(raw)).toBeNull();
  });
});
