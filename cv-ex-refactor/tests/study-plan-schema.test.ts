// Unit tests for studyPlanSchema — covers theme count bounds, course
// count bounds, platform/freeKind enums, NO-URL contract (any string
// allowed in title; URL detection is on the rendering side, not in
// schema), estimatedHours cap.

import { describe, it, expect } from 'vitest';
import { studyPlanSchema } from '@/lib/llm/schemas-study-plan';

function makeTheme(overrides: Record<string, unknown> = {}) {
  return {
    name: 'System Design Trade-offs',
    why: 'Câu Q3 và Q7 chấm điểm thấp vì thiếu trade-off rõ ràng và không nêu được second-order effects.',
    linkedQuestionIds: ['q3', 'q7'],
    courses: [
      {
        platform: 'coursera',
        title: 'Cloud Architecture Patterns',
        difficulty: 'intermediate',
        estimatedHours: 30,
      },
    ],
    freeResource: {
      kind: 'youtube',
      title: 'ByteByteGo system design playlist',
      summary: 'Animated breakdowns of common system design problems for interview prep.',
    },
    ...overrides,
  };
}

describe('studyPlanSchema', () => {
  it('accepts a 2-theme valid plan', () => {
    const plan = { themes: [makeTheme(), makeTheme({ name: 'Quantify Impact' })] };
    expect(studyPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('accepts a 4-theme valid plan (upper bound)', () => {
    const plan = { themes: Array.from({ length: 4 }, (_, i) => makeTheme({ name: `Theme ${i}` })) };
    expect(studyPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('rejects a 1-theme plan (lower bound)', () => {
    expect(studyPlanSchema.safeParse({ themes: [makeTheme()] }).success).toBe(false);
  });

  it('rejects a 5-theme plan (upper bound)', () => {
    const plan = { themes: Array.from({ length: 5 }, (_, i) => makeTheme({ name: `Theme ${i}` })) };
    expect(studyPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('rejects an unknown platform value', () => {
    const plan = {
      themes: [
        makeTheme({
          courses: [
            { platform: 'imaginary-academy', title: 'Some course', difficulty: 'beginner', estimatedHours: 10 },
          ],
        }),
        makeTheme(),
      ],
    };
    expect(studyPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('rejects an unknown freeResource.kind (blog dropped per operator decision)', () => {
    const plan = {
      themes: [
        makeTheme({ freeResource: { kind: 'blog', title: 'Some blog', summary: 'Random blog series.' } }),
        makeTheme(),
      ],
    };
    expect(studyPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('rejects estimatedHours > 200', () => {
    const plan = {
      themes: [
        makeTheme({
          courses: [{ platform: 'coursera', title: 'Long course', difficulty: 'advanced', estimatedHours: 250 }],
        }),
        makeTheme(),
      ],
    };
    expect(studyPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('rejects more than 2 courses per theme', () => {
    const plan = {
      themes: [
        makeTheme({
          courses: [
            { platform: 'coursera', title: 'A', difficulty: 'beginner', estimatedHours: 10 },
            { platform: 'udemy', title: 'B', difficulty: 'beginner', estimatedHours: 10 },
            { platform: 'edx', title: 'C', difficulty: 'beginner', estimatedHours: 10 },
          ],
        }),
        makeTheme(),
      ],
    };
    expect(studyPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('rejects a question id outside q1..q10', () => {
    const plan = {
      themes: [
        makeTheme({ linkedQuestionIds: ['q11'] }),
        makeTheme(),
      ],
    };
    expect(studyPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('accepts VN platforms', () => {
    const plan = {
      themes: [
        makeTheme({
          courses: [{ platform: 'funix', title: 'Khóa lập trình Web', difficulty: 'beginner', estimatedHours: 40 }],
        }),
        makeTheme({
          courses: [{ platform: 'mindx', title: 'Khóa Data', difficulty: 'intermediate', estimatedHours: 30 }],
        }),
      ],
    };
    expect(studyPlanSchema.safeParse(plan).success).toBe(true);
  });
});
