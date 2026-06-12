// Interview Practice — grade prompt builder.
//
// Single batched LLM call grades all 10 answers at once. Cheaper than
// 10 separate calls + keeps calibration consistent across the session.
//
// Token budget:
//   input  ≈ 4.0–5.0k tokens (10 Q + rubric + answers)
//   output ≈ 2.0–3.0k tokens (10 grades + feedback + improvements)
//
// Output contract: schemas-interview.ts:interviewGradeOutputSchema
// — an array of 10 grade objects keyed by the same id as the input Q.

import type { Language } from '@/features/analyze/types';
import type { InterviewQuestion } from './schemas-interview';

export interface InterviewGradeInputs {
  /** The original 10 questions + rubrics emitted by the gen call. */
  questions: InterviewQuestion[];
  /** User-supplied answers — same length as questions, indexed by id. */
  answers: Array<{ id: string; userAnswer: string }>;
  /** Target role for tonal anchoring of feedback. */
  targetRole: string;
  /** Output language. */
  locale?: Language;
}

export interface BuiltInterviewPrompts {
  system: string;
  user: string;
}

const SCHEMA = `[
  {
    "id": "q1",
    "score": "integer 0..10",
    "feedback": "1-3 sentences on what the answer did well and what was missing",
    "improvements": ["1-4 specific, actionable improvements"]
  }
  // ... 10 grades total, one per question, ids must match input
]`;

const SCORE_KEY = `Score scale (integer 0..10, anchor strictly — do NOT cluster around 5):
- 0-2 = fail — off-topic, factually wrong, refuses to engage, or empty
- 3-5 = weak — surface-level, generic, missing trade-offs / metrics / specifics; matches rubric.failSignals
- 6-7 = solid — competent answer covering the rubric criteria with concrete examples
- 8-10 = excellent — senior-grade signal: trade-offs called out, metrics, second-order effects, candor about limitations; matches rubric.excellentSignals
Anchors within a band: a barely-passing weak answer is a 3; a strong-weak (almost solid) is a 5. A textbook-solid answer is a 7; a near-excellent answer is an 8. Reserve 10 for truly outstanding answers.`;

const truncate = (s: string, n: number) =>
  s.length <= n ? s : `${s.slice(0, n - 1)}…`;

export function buildInterviewGradePrompt(inputs: InterviewGradeInputs): BuiltInterviewPrompts {
  const { questions, answers, targetRole, locale = 'auto' } = inputs;

  const langInstr =
    locale === 'vi'
      ? 'Respond in Vietnamese for all human-readable text fields; keep JSON keys English.'
      : locale === 'en'
        ? 'Respond in English.'
        : 'Match the language of the candidate answers; keep JSON keys English.';

  const viRegisterLock =
    locale === 'vi' || locale === 'auto'
      ? '\n- If output is Vietnamese: direct coaching register. No honorifics, no marketing puffery. Keep proper nouns + tools in English.'
      : '';

  // Zip questions with answers by id (caller already guarantees same length
  // + matching ids, but defensive lookup keeps prompt robust to reorder).
  const answerById = new Map(answers.map((a) => [a.id, a.userAnswer]));
  const qaBlocks = questions
    .map((q) => {
      const ans = answerById.get(q.id)?.trim() ?? '';
      const ansText = ans.length === 0 ? '(no answer provided)' : truncate(ans, 1500);
      return `--- ${q.id} (${q.type}) ---
Question: ${q.question}
Rubric criteria: ${q.rubric.criteria}
Excellent signals: ${q.rubric.excellentSignals.join(' | ')}
Fail signals: ${q.rubric.failSignals.join(' | ')}
Candidate answer:
${ansText}`;
    })
    .join('\n\n');

  const system =
    'You are a former Big-Tech senior interviewer grading practice-interview answers against rubrics. You are strict but fair — you do not inflate scores. You produce concise, specific feedback that names what the candidate missed and how to fix it. Always return ONE valid JSON array matching the requested schema — no commentary, no markdown fences. Never invent achievements that the candidate did not state in their answer.';

  const user = `Grade all 10 candidate answers below against their rubrics. Target role: ${targetRole}.

${SCORE_KEY}

=== GRADING RULES ===
- Return exactly 10 grade objects, one per question, ids matching input (q1..q10).
- Score strictly against the rubric — answers matching \`failSignals\` land in 0-5; answers matching \`excellentSignals\` land in 8-10.
- A blank or "(no answer provided)" answer → score 0 with feedback noting the omission.
- \`feedback\` (1-3 sentences): name what the answer did well, what it missed. Be specific — cite the rubric.
- \`improvements\` (1-4 bullets): actionable, candidate-can-act-on-tomorrow. No "study more X" — say "next time, quantify the impact of …" or "explain why you chose React over Vue, not just that you used React".

=== QUESTIONS + ANSWERS ===
${qaBlocks}

=== OUTPUT PARAMS ===
- ${langInstr}${viRegisterLock}
- Return ONLY one valid JSON array matching this schema (no commentary, no markdown fences):
${SCHEMA}`;

  return { system, user };
}
