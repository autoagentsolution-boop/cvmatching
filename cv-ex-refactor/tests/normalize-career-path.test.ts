import { describe, it, expect } from 'vitest';
import { normalizeCareerPath } from '@/lib/llm/normalize-career-path';

describe('normalizeCareerPath', () => {
  it('parses a complete new-shape response end-to-end', () => {
    const raw = {
      feasibility: {
        realistic: true,
        reasons: [],
        ambitionGap: '',
        requiredSteps: [],
      },
      currentSnapshot: { detectedRole: 'Senior Backend Engineer', coreStrengths: ['Node'], signatureProjects: [] },
      targetRole: { title: 'Staff Engineer', rationale: 'Fits', fitScore: 70 },
      milestones: [],
      skillGaps: [],
      alternativePaths: [
        { title: 'Engineering Manager', rationale: 'EM track', pivotSteps: ['Step 1'] },
      ],
      quickWins: {
        days30: [{ action: 'Author RFC', effortHours: 8, outcome: 'Posted' }],
        days60: [],
        days90: [],
      },
    };
    const result = normalizeCareerPath(raw);
    expect(result.feasibility.realistic).toBe(true);
    expect(result.alternativePaths).toHaveLength(1);
    expect(result.quickWins.days30[0]).toEqual({ action: 'Author RFC', effortHours: 8, outcome: 'Posted' });
  });

  describe('Phase 2 — feasibility shape', () => {
    it('passes through ambitionGap + requiredSteps when emitted', () => {
      const raw = {
        feasibility: {
          realistic: false,
          reasons: ['No DDIA evidence'],
          ambitionGap: 'CV shows no distributed-systems track record.',
          requiredSteps: ['Read DDIA', 'Build sharded counter on Postgres', 'Write blog post'],
        },
      };
      const result = normalizeCareerPath(raw);
      expect(result.feasibility.ambitionGap).toBe('CV shows no distributed-systems track record.');
      expect(result.feasibility.requiredSteps).toEqual([
        'Read DDIA',
        'Build sharded counter on Postgres',
        'Write blog post',
      ]);
    });

    it('falls back to legacy gentleAdvice → ambitionGap when ambitionGap absent (unrealistic)', () => {
      const raw = {
        feasibility: {
          realistic: false,
          reasons: ['Gap detected'],
          gentleAdvice: 'Cố gắng tham vọng của bạn rất đáng quý, nhưng cần thêm thời gian.',
        },
      };
      const result = normalizeCareerPath(raw);
      expect(result.feasibility.ambitionGap).toBe('Cố gắng tham vọng của bạn rất đáng quý, nhưng cần thêm thời gian.');
      expect(result.feasibility.gentleAdvice).toBe('Cố gắng tham vọng của bạn rất đáng quý, nhưng cần thêm thời gian.');
    });

    it('does NOT promote gentleAdvice to ambitionGap when realistic=true', () => {
      const raw = {
        feasibility: { realistic: true, gentleAdvice: '' },
      };
      const result = normalizeCareerPath(raw);
      expect(result.feasibility.ambitionGap).toBeUndefined();
    });
  });

  describe('Phase 2 — quickWins union (object OR legacy string)', () => {
    it('parses {action, effortHours, outcome} object shape', () => {
      const raw = {
        quickWins: {
          days30: [
            { action: 'Author RFC', effortHours: 8, outcome: 'Posted; +2 reviewers' },
            { action: 'Mentor mid-level eng', effortHours: 4, outcome: 'Promoted' },
          ],
          days60: [],
          days90: [],
        },
      };
      const result = normalizeCareerPath(raw);
      expect(result.quickWins.days30).toHaveLength(2);
      expect(result.quickWins.days30[0]).toEqual({
        action: 'Author RFC',
        effortHours: 8,
        outcome: 'Posted; +2 reviewers',
      });
    });

    it('migrates legacy string[] entries into {action, effortHours:0, outcome:""}', () => {
      const raw = {
        quickWins: {
          days30: ['Refactor legacy module', 'Ship perf benchmark'],
          days60: [],
          days90: [],
        },
      };
      const result = normalizeCareerPath(raw);
      expect(result.quickWins.days30).toEqual([
        { action: 'Refactor legacy module', effortHours: 0, outcome: '' },
        { action: 'Ship perf benchmark', effortHours: 0, outcome: '' },
      ]);
    });

    it('drops malformed entries (no action / null / number)', () => {
      const raw = {
        quickWins: {
          days30: [
            { effortHours: 8, outcome: 'Lost — no action' },
            null,
            42,
            { action: '', effortHours: 4, outcome: '' },
            { action: 'Valid action', effortHours: 6, outcome: 'kept' },
          ],
          days60: [],
          days90: [],
        },
      };
      const result = normalizeCareerPath(raw);
      expect(result.quickWins.days30).toHaveLength(1);
      expect(result.quickWins.days30[0]!.action).toBe('Valid action');
    });

    it('clamps effortHours to [0, 80]', () => {
      const raw = {
        quickWins: {
          days30: [
            { action: 'Negative', effortHours: -5, outcome: '' },
            { action: 'Huge', effortHours: 9999, outcome: '' },
          ],
          days60: [],
          days90: [],
        },
      };
      const result = normalizeCareerPath(raw);
      expect(result.quickWins.days30[0]!.effortHours).toBe(0);
      expect(result.quickWins.days30[1]!.effortHours).toBe(80);
    });
  });

  describe('Phase 2 — alternativePaths stub injection', () => {
    it('injects stub when LLM returns 0 alternative paths', () => {
      const raw = { alternativePaths: [] };
      const result = normalizeCareerPath(raw);
      expect(result.alternativePaths).toHaveLength(1);
      expect(result.alternativePaths[0]!.title).toBe('No alternative path identified');
    });

    it('injects stub when alternativePaths field is missing', () => {
      const raw = {};
      const result = normalizeCareerPath(raw);
      expect(result.alternativePaths).toHaveLength(1);
    });

    it('passes through ≥1 LLM-provided alternative paths unchanged', () => {
      const raw = {
        alternativePaths: [
          { title: 'EM Track', rationale: 'Strong mentorship', pivotSteps: ['Step A'] },
        ],
      };
      const result = normalizeCareerPath(raw);
      expect(result.alternativePaths).toHaveLength(1);
      expect(result.alternativePaths[0]!.title).toBe('EM Track');
    });
  });
});
