import { describe, it, expect, vi } from 'vitest';
import { normalizeRecommend, parseLegacyEstimatedHours } from '@/lib/llm/normalize-job-recommend';
import type { Job } from '@/lib/jobs/types';

function makeJob(id: string): Job {
  return {
    id,
    title: `Job ${id}`,
    company: 'Acme Corp',
    vertical: 'tech',
    seniority: 'mid',
    description: 'Some description',
    sourceUrl: `https://example.com/job/${id}`,
    source: 'other',
    location: 'HCM',
    postedAt: '2026-01-01T00:00:00Z',
    verifiedAt: '2026-01-01T00:00:00Z',
    embedding: '',
  };
}

const VALID_DIM_SCORES = {
  skills: 90, experience: 85, education: 80,
  industry: 88, seniority: 82, location: 75,
  tools: 91, soft: 78, domain: 84,
};

const VALID_STUDY_TOPICS = [
  { name: 'TypeScript', category: 'backend' as const, tier: 'intermediate' as const, whyForThisJob: 'JD yêu cầu TS', estimatedHours: '10h' },
  { name: 'Docker', category: 'devops' as const, tier: 'basic' as const, whyForThisJob: 'JD yêu cầu Docker', estimatedHours: '8h' },
  { name: 'Redis', category: 'db' as const, tier: 'intermediate' as const, whyForThisJob: 'JD nêu Redis caching', estimatedHours: '6h' },
];

function makeRawMatch(jobId: string, overallScore = 90) {
  return {
    jobId,
    overallScore,
    dimensionScores: VALID_DIM_SCORES,
    matchReasons: ['Lý do 1', 'Lý do 2', 'Lý do 3'],
    studyTopics: VALID_STUDY_TOPICS,
  };
}

describe('normalizeRecommend', () => {
  it('returns valid matches enriched with job metadata', () => {
    const jobId = 'abc123';
    const raw = { jobs: [makeRawMatch(jobId, 95)] };
    const map = new Map([[jobId, makeJob(jobId)]]);

    const result = normalizeRecommend(raw, map);

    expect(result).toHaveLength(1);
    expect(result[0]!.jobId).toBe(jobId);
    expect(result[0]!.overallScore).toBe(95);
    expect(result[0]!.title).toBe(`Job ${jobId}`);
    expect(result[0]!.company).toBe('Acme Corp');
    expect(result[0]!.sourceUrl).toBe(`https://example.com/job/${jobId}`);
  });

  it('keeps entries across the full score range (Wave A: no overallScore filter)', () => {
    const map = new Map([
      ['id-hi', makeJob('id-hi')],
      ['id-mid', makeJob('id-mid')],
      ['id-lo', makeJob('id-lo')],
    ]);
    const raw = {
      jobs: [
        makeRawMatch('id-hi', 85),
        makeRawMatch('id-mid', 70),
        makeRawMatch('id-lo', 40),
      ],
    };

    const result = normalizeRecommend(raw, map);

    // No score-based dropping; all three pass since tiers/quotas have room.
    expect(result.map((r) => r.jobId).sort()).toEqual(['id-hi', 'id-lo', 'id-mid']);
  });

  it('derives tier from overallScore', () => {
    const ids = ['s', 'a', 'b', 'c', 'd', 'e'];
    const map = new Map(ids.map((id) => [id, makeJob(id)]));
    const raw = {
      jobs: [
        makeRawMatch('s', 96),
        makeRawMatch('a', 88),
        makeRawMatch('b', 78),
        makeRawMatch('c', 68),
        makeRawMatch('d', 58),
        makeRawMatch('e', 40),
      ],
    };

    const result = normalizeRecommend(raw, map);
    const byId = new Map(result.map((r) => [r.jobId, r.tier]));
    expect(byId.get('s')).toBe('S');
    expect(byId.get('a')).toBe('A');
    expect(byId.get('b')).toBe('B');
    expect(byId.get('c')).toBe('C');
    expect(byId.get('d')).toBe('D');
    expect(byId.get('e')).toBe('E');
  });

  it('drops entries whose jobId is not in jobsById (hallucinated id)', () => {
    const map = new Map([['real-id', makeJob('real-id')]]);
    const raw = {
      jobs: [
        makeRawMatch('real-id', 92),
        makeRawMatch('hallucinated-id', 95),
      ],
    };

    const result = normalizeRecommend(raw, map);

    expect(result).toHaveLength(1);
    expect(result[0]!.jobId).toBe('real-id');
  });

  it('drops entries missing dimensionScores', () => {
    const jobId = 'no-dims';
    const map = new Map([[jobId, makeJob(jobId)]]);
    const raw = {
      jobs: [
        {
          jobId,
          overallScore: 95,
          // dimensionScores intentionally omitted
          matchReasons: ['r1', 'r2', 'r3'],
          studyTopics: VALID_STUDY_TOPICS,
        },
      ],
    };

    const result = normalizeRecommend(raw, map);
    expect(result).toHaveLength(0);
  });

  it('drops entries with incomplete dimensionScores (missing field)', () => {
    const jobId = 'partial-dims';
    const map = new Map([[jobId, makeJob(jobId)]]);
    const raw = {
      jobs: [
        {
          jobId,
          overallScore: 90,
          dimensionScores: { skills: 90 }, // missing 8 required fields
          matchReasons: ['r1', 'r2', 'r3'],
          studyTopics: VALID_STUDY_TOPICS,
        },
      ],
    };

    const result = normalizeRecommend(raw, map);
    expect(result).toHaveLength(0);
  });

  it('sorts results descending by overallScore', () => {
    const ids = ['a', 'b', 'c'];
    const map = new Map(ids.map((id) => [id, makeJob(id)]));
    const raw = {
      jobs: [
        makeRawMatch('a', 82),
        makeRawMatch('b', 95),
        makeRawMatch('c', 88),
      ],
    };

    const result = normalizeRecommend(raw, map);
    expect(result.map((r) => r.jobId)).toEqual(['b', 'c', 'a']);
  });

  it('caps each tier by QUOTA — 15 jobs at score 90 (tier A) capped to QUOTA.A = 3', () => {
    const ids = Array.from({ length: 15 }, (_, i) => `job-${i}`);
    const map = new Map(ids.map((id) => [id, makeJob(id)]));
    const raw = { jobs: ids.map((id) => makeRawMatch(id, 90)) };

    const result = normalizeRecommend(raw, map);
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.tier === 'A')).toBe(true);
  });

  it('respects per-tier quota across mixed scores (total ≤ 10)', () => {
    // QUOTA: S=1 A=3 B=2 C=2 D=1 E=1 → max 10 total
    const ids = Array.from({ length: 30 }, (_, i) => `job-${i}`);
    const map = new Map(ids.map((id) => [id, makeJob(id)]));
    const raw = {
      jobs: [
        // 3 in S (96+), expect 1 kept
        ...[96, 97, 98].map((s, i) => makeRawMatch(`job-${i}`, s)),
        // 5 in A (85-94), expect 3 kept
        ...[86, 87, 88, 89, 90].map((s, i) => makeRawMatch(`job-${i + 3}`, s)),
        // 4 in B (75-84), expect 2 kept
        ...[75, 78, 80, 82].map((s, i) => makeRawMatch(`job-${i + 8}`, s)),
        // 2 in E (0-54), expect 1 kept
        ...[20, 30].map((s, i) => makeRawMatch(`job-${i + 12}`, s)),
      ],
    };

    const result = normalizeRecommend(raw, map);
    // 1 + 3 + 2 + 1 = 7 expected
    expect(result).toHaveLength(7);
    expect(result.filter((r) => r.tier === 'S')).toHaveLength(1);
    expect(result.filter((r) => r.tier === 'A')).toHaveLength(3);
    expect(result.filter((r) => r.tier === 'B')).toHaveLength(2);
    expect(result.filter((r) => r.tier === 'E')).toHaveLength(1);
  });

  it('returns empty array when raw is null', () => {
    const map = new Map([['x', makeJob('x')]]);
    expect(normalizeRecommend(null, map)).toHaveLength(0);
  });

  it('returns empty array when jobs array is empty', () => {
    const map = new Map([['x', makeJob('x')]]);
    expect(normalizeRecommend({ jobs: [] }, map)).toHaveLength(0);
  });

  describe('Phase 1c — estimatedHours object shape + tier drift', () => {
    it('accepts the new {min,max} estimatedHours shape and passes through', () => {
      const jobId = 'topic-obj';
      const map = new Map([[jobId, makeJob(jobId)]]);
      const raw = {
        jobs: [
          {
            ...makeRawMatch(jobId, 88),
            studyTopics: [
              {
                name: 'TS', category: 'backend' as const, tier: 'intermediate' as const,
                whyForThisJob: 'JD yêu cầu', estimatedHours: { min: 6, max: 12 },
              },
            ],
          },
        ],
      };
      const result = normalizeRecommend(raw, map);
      expect(result).toHaveLength(1);
      expect(result[0]!.studyTopics[0]!.estimatedHours).toEqual({ min: 6, max: 12 });
    });

    it('parses legacy "4-8h" string into {min:4,max:8}', () => {
      expect(parseLegacyEstimatedHours('4-8h')).toEqual({ min: 4, max: 8 });
      expect(parseLegacyEstimatedHours('10h')).toEqual({ min: 10, max: 14 });
      expect(parseLegacyEstimatedHours('1-2 ngày')).toEqual({ min: 8, max: 16 });
      expect(parseLegacyEstimatedHours('khoảng 6 giờ')).toEqual({ min: 6, max: 10 });
      expect(parseLegacyEstimatedHours('không rõ')).toEqual({ min: 4, max: 8 });
    });

    it('normalizes legacy string shape into {min,max} during normalize', () => {
      const jobId = 'legacy-string';
      const map = new Map([[jobId, makeJob(jobId)]]);
      const raw = {
        jobs: [
          {
            ...makeRawMatch(jobId, 88),
            studyTopics: [
              {
                name: 'Docker', category: 'devops' as const, tier: 'basic' as const,
                whyForThisJob: 'JD nêu', estimatedHours: '12-18h',
              },
            ],
          },
        ],
      };
      const result = normalizeRecommend(raw, map);
      expect(result[0]!.studyTopics[0]!.estimatedHours).toEqual({ min: 12, max: 18 });
    });

    it('passes through LLM tier without changing server-derived authoritative tier', () => {
      const jobId = 'tier-llm';
      const map = new Map([[jobId, makeJob(jobId)]]);
      // 96 → server tier 'S' (>=95 boundary)
      const raw = {
        jobs: [{ ...makeRawMatch(jobId, 96), tier: 'S' as const }],
      };
      const result = normalizeRecommend(raw, map);
      expect(result[0]!.tier).toBe('S');
    });

    it('warns on LLM tier drift vs server tier (mismatched boundary)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const jobId = 'tier-drift';
      const map = new Map([[jobId, makeJob(jobId)]]);
      // overallScore 70 → server tier 'C' (65-74 band); LLM mis-emits 'A'
      const raw = {
        jobs: [{ ...makeRawMatch(jobId, 70), tier: 'A' as const }],
      };
      const result = normalizeRecommend(raw, map);
      expect(result[0]!.tier).toBe('C'); // server still wins
      expect(warnSpy).toHaveBeenCalledWith(
        '[job-fit] llm tier drift',
        expect.objectContaining({ jobId, llmTier: 'A', serverTier: 'C' }),
      );
      warnSpy.mockRestore();
    });

    it('does NOT warn when LLM tier matches server tier', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const jobId = 'tier-match';
      const map = new Map([[jobId, makeJob(jobId)]]);
      const raw = { jobs: [{ ...makeRawMatch(jobId, 96), tier: 'S' as const }] };
      normalizeRecommend(raw, map);
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
