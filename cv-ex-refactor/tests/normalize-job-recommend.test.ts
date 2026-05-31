import { describe, it, expect } from 'vitest';
import { normalizeRecommend } from '@/lib/llm/normalize-job-recommend';
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

  it('drops entries with overallScore <= 80', () => {
    const map = new Map([
      ['id-pass', makeJob('id-pass')],
      ['id-fail-80', makeJob('id-fail-80')],
      ['id-fail-50', makeJob('id-fail-50')],
    ]);
    const raw = {
      jobs: [
        makeRawMatch('id-pass', 85),
        makeRawMatch('id-fail-80', 80),
        makeRawMatch('id-fail-50', 50),
      ],
    };

    const result = normalizeRecommend(raw, map);

    expect(result).toHaveLength(1);
    expect(result[0]!.jobId).toBe('id-pass');
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

  it('slices to maximum 10 results', () => {
    const ids = Array.from({ length: 15 }, (_, i) => `job-${i}`);
    const map = new Map(ids.map((id) => [id, makeJob(id)]));
    const raw = { jobs: ids.map((id) => makeRawMatch(id, 90)) };

    const result = normalizeRecommend(raw, map);
    expect(result).toHaveLength(10);
  });

  it('returns empty array when raw is null', () => {
    const map = new Map([['x', makeJob('x')]]);
    expect(normalizeRecommend(null, map)).toHaveLength(0);
  });

  it('returns empty array when jobs array is empty', () => {
    const map = new Map([['x', makeJob('x')]]);
    expect(normalizeRecommend({ jobs: [] }, map)).toHaveLength(0);
  });
});
