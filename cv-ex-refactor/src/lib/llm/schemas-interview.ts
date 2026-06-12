// Zod schemas for Interview Practice LLM outputs.
//
// Two prompts, two contracts:
//   1. interview-gen → { dualLens, questions[10] }
//   2. interview-grade → grades[10]
//
// Schema-validation failure surfaces to the route (no silent retry loop —
// see memory feedback_error_surfacing_no_silent_fallback). The route may
// retry ONCE then return 503 with an actionable error.
//
// JSONB shape persisted in `interview_sessions.questions` after grading
// is each question merged with `user_answer` + `grade` keys — the grade
// schema deliberately mirrors the question id so the merge is a 1:1 zip
// keyed by `id`.

import { z } from 'zod';

// ─── Dual Lens ────────────────────────────────────────────────────────────
//
// 4 quadrants from BOTH sides — recruiter Hire/No-hire × candidate
// Hire/No-hire. Each quadrant returns 2-4 bullets, no prose. Keep
// per-bullet length short (≤ 140 chars) so the UI card stays scannable.

const bulletList = z.array(z.string().min(3).max(280)).min(2).max(5);

export const dualLensSchema = z.object({
  // Recruiter's view — why they would say yes vs no.
  recruiterHire: z.object({
    reasons: bulletList,
    signals: bulletList,
  }),
  recruiterNoHire: z.object({
    risks: bulletList,
    gaps: bulletList,
  }),
  // Candidate's view — why the candidate should say yes vs no to the role.
  candidateHire: z.object({
    opportunities: bulletList,
    growth: bulletList,
  }),
  candidateNoHire: z.object({
    risks: bulletList,
    mismatches: bulletList,
  }),
});

export type DualLens = z.infer<typeof dualLensSchema>;

// ─── Question + Rubric ────────────────────────────────────────────────────

export const interviewQuestionType = z.enum(['behavioral', 'technical', 'scenario']);
export type InterviewQuestionType = z.infer<typeof interviewQuestionType>;

export const interviewQuestionSchema = z.object({
  // Strict id format: q1..q10. Drives the zip-by-id merge in the route.
  id: z.string().regex(/^q([1-9]|10)$/, 'id must match q1..q10'),
  type: interviewQuestionType,
  question: z.string().min(20).max(800),
  rubric: z.object({
    criteria: z.string().min(20).max(400),
    excellentSignals: z.array(z.string().min(5).max(200)).min(2).max(5),
    failSignals: z.array(z.string().min(5).max(200)).min(2).max(5),
  }),
});

export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;

// ─── Gen output ───────────────────────────────────────────────────────────
//
// Refines:
//   - Exactly 10 questions
//   - Exactly 4 behavioral + 4 technical + 2 scenario
//   - ids are q1..q10 unique (covered by item regex + length === 10 + Set)

export const interviewGenOutputSchema = z
  .object({
    dualLens: dualLensSchema,
    questions: z.array(interviewQuestionSchema).length(10, 'must return exactly 10 questions'),
  })
  .refine(
    (out) => new Set(out.questions.map((q) => q.id)).size === 10,
    { message: 'question ids must be unique', path: ['questions'] },
  )
  .refine(
    (out) => {
      const counts = { behavioral: 0, technical: 0, scenario: 0 } as Record<InterviewQuestionType, number>;
      for (const q of out.questions) counts[q.type] += 1;
      return counts.behavioral === 4 && counts.technical === 4 && counts.scenario === 2;
    },
    { message: 'question type distribution must be 4 behavioral / 4 technical / 2 scenario', path: ['questions'] },
  );

export type InterviewGenOutput = z.infer<typeof interviewGenOutputSchema>;

// ─── Grade output ─────────────────────────────────────────────────────────
//
// 10 grades, one per question, identified by the same id. Score 0..10
// (integer). Bucket semantics applied in UI:
//   0-2  = Fail        (off-topic / wrong / no engagement)
//   3-5  = Yếu/Weak    (surface-level, generic, missing specifics)
//   6-7  = Khá/Solid   (competent, covers rubric, has examples)
//   8-10 = Xuất sắc    (senior-grade — trade-offs, metrics, candor)

export const interviewGradeSchema = z.object({
  id: z.string().regex(/^q([1-9]|10)$/, 'id must match q1..q10'),
  score: z.number().int().min(0).max(10),
  feedback: z.string().min(20).max(600),
  improvements: z.array(z.string().min(5).max(220)).min(1).max(4),
});

export type InterviewGrade = z.infer<typeof interviewGradeSchema>;

export const interviewGradeOutputSchema = z
  .array(interviewGradeSchema)
  .length(10, 'must return exactly 10 grades')
  .refine(
    (arr) => new Set(arr.map((g) => g.id)).size === 10,
    { message: 'grade ids must be unique' },
  );

export type InterviewGradeOutput = z.infer<typeof interviewGradeOutputSchema>;

// ─── Overall score helper ─────────────────────────────────────────────────
//
// Per-question score is already 0..10 integer; overall is the mean,
// rounded to 1 decimal. Caller persists `Math.round(overall * 10)` so
// `overall_score` INTEGER in DB stays in the 0..100 range (no float
// round-trip drift through pg).

export function computeOverallScore10(grades: InterviewGrade[]): number {
  if (grades.length === 0) return 0;
  const sum = grades.reduce((acc, g) => acc + g.score, 0);
  const avg = sum / grades.length; // 0..10
  return Math.round(avg * 10) / 10; // 1 decimal
}
