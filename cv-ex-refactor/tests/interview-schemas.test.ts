// Unit tests for interview Zod schemas + computeOverallScore10.

import { describe, it, expect } from 'vitest';
import {
  dualLensSchema,
  interviewGenOutputSchema,
  interviewGradeOutputSchema,
  computeOverallScore10,
  type InterviewQuestion,
} from '@/lib/llm/schemas-interview';

// ── Fixtures ─────────────────────────────────────────────────────────────

const VALID_DUAL_LENS = {
  recruiterHire: { reasons: ['a strong reason', 'second reason'], signals: ['scope ownership', 'metric-led bullets'] },
  recruiterNoHire: { risks: ['scope smaller than required', 'no team leadership'], gaps: ['payment domain', 'k8s production'] },
  candidateHire: { opportunities: ['platform scale', 'mentor seniors'], growth: ['system design depth', 'ic-to-lead path'] },
  candidateNoHire: { risks: ['burnout potential', 'commute long'], mismatches: ['relocation needed', 'on-call rotation'] },
};

function makeQ(id: string, type: 'behavioral' | 'technical' | 'scenario'): InterviewQuestion {
  return {
    id,
    type,
    question: `Question text for ${id} — at least twenty characters long to satisfy min`,
    rubric: {
      criteria: 'What a competent answer covers — at least twenty characters long.',
      excellentSignals: ['signal a', 'signal b'],
      failSignals: ['fail a', 'fail b'],
    },
  };
}

function makeValidGenOutput() {
  const questions: InterviewQuestion[] = [
    ...Array.from({ length: 4 }, (_, i) => makeQ(`q${i + 1}`, 'behavioral')),
    ...Array.from({ length: 4 }, (_, i) => makeQ(`q${i + 5}`, 'technical')),
    ...Array.from({ length: 2 }, (_, i) => makeQ(`q${i + 9}`, 'scenario')),
  ];
  return { dualLens: VALID_DUAL_LENS, questions };
}

// ── dualLensSchema ───────────────────────────────────────────────────────

describe('dualLensSchema', () => {
  it('accepts a valid 4-quadrant lens', () => {
    expect(dualLensSchema.safeParse(VALID_DUAL_LENS).success).toBe(true);
  });

  it('rejects when a quadrant is missing', () => {
    const broken = { ...VALID_DUAL_LENS } as Partial<typeof VALID_DUAL_LENS>;
    delete broken.candidateHire;
    expect(dualLensSchema.safeParse(broken).success).toBe(false);
  });

  it('rejects when a quadrant block has fewer than 2 bullets', () => {
    const broken = {
      ...VALID_DUAL_LENS,
      recruiterHire: { reasons: ['only one bullet here'], signals: ['scope ownership', 'metric-led bullets'] },
    };
    expect(dualLensSchema.safeParse(broken).success).toBe(false);
  });
});

// ── interviewGenOutputSchema ─────────────────────────────────────────────

describe('interviewGenOutputSchema', () => {
  it('accepts a valid 4/4/2 distribution', () => {
    expect(interviewGenOutputSchema.safeParse(makeValidGenOutput()).success).toBe(true);
  });

  it('rejects when fewer than 10 questions are returned', () => {
    const out = makeValidGenOutput();
    out.questions = out.questions.slice(0, 9);
    expect(interviewGenOutputSchema.safeParse(out).success).toBe(false);
  });

  it('rejects when distribution is not 4/4/2', () => {
    const out = makeValidGenOutput();
    out.questions[0] = { ...out.questions[0]!, type: 'technical' };
    expect(interviewGenOutputSchema.safeParse(out).success).toBe(false);
  });

  it('rejects when question ids are duplicated', () => {
    const out = makeValidGenOutput();
    out.questions[1] = { ...out.questions[1]!, id: 'q1' };
    expect(interviewGenOutputSchema.safeParse(out).success).toBe(false);
  });

  it('rejects when an id is not q1..q10', () => {
    const out = makeValidGenOutput();
    out.questions[0] = { ...out.questions[0]!, id: 'q11' };
    expect(interviewGenOutputSchema.safeParse(out).success).toBe(false);
  });
});

// ── interviewGradeOutputSchema ───────────────────────────────────────────

function makeValidGrades() {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `q${i + 1}`,
    score: (i % 11) as number,
    feedback: 'A concrete feedback that exceeds twenty characters easily.',
    improvements: ['be more specific about the trade-offs you considered'],
  }));
}

describe('interviewGradeOutputSchema', () => {
  it('accepts 10 grades with integer scores 0..10', () => {
    expect(interviewGradeOutputSchema.safeParse(makeValidGrades()).success).toBe(true);
  });

  it('rejects a score of 11 (out of range)', () => {
    const grades = makeValidGrades();
    grades[0] = { ...grades[0]!, score: 11 };
    expect(interviewGradeOutputSchema.safeParse(grades).success).toBe(false);
  });

  it('rejects a non-integer score', () => {
    const grades = makeValidGrades();
    grades[0] = { ...grades[0]!, score: 5.5 };
    expect(interviewGradeOutputSchema.safeParse(grades).success).toBe(false);
  });

  it('rejects when grade count is not 10', () => {
    expect(interviewGradeOutputSchema.safeParse(makeValidGrades().slice(0, 9)).success).toBe(false);
  });

  it('rejects when grade ids duplicate', () => {
    const grades = makeValidGrades();
    grades[1] = { ...grades[1]!, id: 'q1' };
    expect(interviewGradeOutputSchema.safeParse(grades).success).toBe(false);
  });
});

// ── computeOverallScore10 ────────────────────────────────────────────────

describe('computeOverallScore10', () => {
  it('returns 0 when all scores are 0', () => {
    const grades = makeValidGrades().map((g) => ({ ...g, score: 0 }));
    expect(computeOverallScore10(grades)).toBe(0);
  });

  it('returns 10 when all scores are 10', () => {
    const grades = makeValidGrades().map((g) => ({ ...g, score: 10 }));
    expect(computeOverallScore10(grades)).toBe(10);
  });

  it('returns the simple average with 1-decimal rounding', () => {
    // 5 × score=8 + 5 × score=4 → avg = 6.0
    const grades = makeValidGrades().map((g, i) => ({ ...g, score: i < 5 ? 8 : 4 }));
    expect(computeOverallScore10(grades)).toBe(6);
  });

  it('rounds 7.66… → 7.7 (1-decimal stable)', () => {
    // 7 × 8 + 3 × 7 = 56 + 21 = 77 → avg = 7.7
    const grades = makeValidGrades().map((g, i) => ({ ...g, score: i < 7 ? 8 : 7 }));
    expect(computeOverallScore10(grades)).toBe(7.7);
  });
});
