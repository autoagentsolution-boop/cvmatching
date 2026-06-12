// Zod schema for the post-interview study plan LLM output.
//
// Shape: 2-4 themed weakness clusters, each with 1-2 paid courses + 1
// free resource. Anti-hallucination contract:
//   - platforms picked from a closed enum (global + VN)
//   - NO course URLs — only title + platform, user searches on the site
//   - course estimatedHours bounded so LLM can't pad "200 hours of XYZ"
//
// linkedQuestionIds points back to q1..q10 so the UI can render "this
// theme stems from your weak answer on Q3 + Q7" hyperlinks.

import { z } from 'zod';

// Closed platform enum prevents hallucinated "MyAcademy.xyz" — user can
// always Ctrl-F the title on the named platform's search.
export const coursePlatformEnum = z.enum([
  // Global paid
  'coursera',
  'udemy',
  'edx',
  'pluralsight',
  'linkedin-learning',
  'datacamp',
  'oreilly',
  // Global free
  'youtube',
  'freecodecamp',
  // Vietnam-specific (operator confirmed VN platforms when locale=vi)
  'funix',
  'mindx',
  'topcv-academy',
  // Fallback for less-mainstream sites
  'other',
]);
export type CoursePlatform = z.infer<typeof coursePlatformEnum>;

export const courseDifficultyEnum = z.enum(['beginner', 'intermediate', 'advanced']);
export type CourseDifficulty = z.infer<typeof courseDifficultyEnum>;

export const courseRefSchema = z.object({
  platform: coursePlatformEnum,
  title: z.string().min(5).max(200),
  difficulty: courseDifficultyEnum,
  // 200h cap — anything claimed beyond that is almost certainly LLM
  // padding ("Complete bootcamp 500 hours"). Real high-quality courses
  // top out around 60-120h.
  estimatedHours: z.number().int().min(1).max(200),
});
export type CourseRef = z.infer<typeof courseRefSchema>;

// Operator decision 2026-06-12: community-vetted sources only. Drop
// generic blog + podcast which are too easy for LLM to fabricate ("Dev
// Insights podcast"). YouTube channels with public subscriber counts,
// official docs from named platforms, and books with ISBNs are
// verifiable; arbitrary blogs/podcasts are not.
export const freeResourceKindEnum = z.enum(['youtube', 'docs', 'book']);
export const freeResourceSchema = z.object({
  kind: freeResourceKindEnum,
  title: z.string().min(5).max(200),
  // Tiny "why this" so the user knows what to expect — keep tight,
  // not a marketing blurb.
  summary: z.string().min(10).max(280),
});
export type FreeResource = z.infer<typeof freeResourceSchema>;

const themeSchema = z.object({
  // Theme name short enough for a card header.
  name: z.string().min(3).max(80),
  // Why this theme matters — one short sentence linking back to the
  // interview, e.g. "Câu Q3 và Q7 chấm 4/10 do thiếu trade-off rõ ràng".
  why: z.string().min(20).max(400),
  // Drives the UI back-link ("This theme covers Q3 + Q7").
  linkedQuestionIds: z
    .array(z.string().regex(/^q([1-9]|10)$/))
    .min(1)
    .max(10),
  courses: z.array(courseRefSchema).min(1).max(2),
  freeResource: freeResourceSchema,
});
export type StudyPlanTheme = z.infer<typeof themeSchema>;

export const studyPlanSchema = z.object({
  themes: z.array(themeSchema).min(2).max(4),
});
export type StudyPlan = z.infer<typeof studyPlanSchema>;
