// Interview Practice — gen prompt builder.
//
// Single LLM call produces BOTH:
//   - Dual Lens (4 quadrants — recruiter Hire/No-hire × candidate Hire/No-hire)
//   - 10 medium-hard questions (4 behavioral + 4 technical + 2 scenario)
// in one JSON object matching schemas-interview.ts:interviewGenOutputSchema.
//
// Token budget (per audit-260609-1539 discipline — keep tight):
//   input  ≈ 2.0–2.5k tokens (system 0.6k + user 1.4–1.9k inc. inputs)
//   output ≈ 2.0–2.5k tokens (4 quadrants 2-5 bullets + 10 Q with rubric)
//
// Provider-agnostic: `system` + `user` strings handed to callLLM(...) with
// JSON response mode. Locale switches output language; JSON keys stay English
// (same convention as prompt-analyze-v3).

import type { Language } from '@/features/analyze/types';

export interface InterviewGenInputs {
  mode: 'job_fit' | 'standalone';
  /** Role the candidate wants to practice for (e.g. "Senior Backend Engineer"). */
  targetRole: string;
  /** job_fit mode — full JD text. Truncated to 1500 chars before prompt build. */
  jobDescription?: string;
  /** job_fit mode — company name for tonal anchoring. */
  companyName?: string;
  /** Role from the candidate's CV used as the experience anchor for behavioral/scenario Q. */
  anchorRoleTitle: string;
  /** Bullet/summary excerpt for the anchor role from the CV (truncated to 600 chars). */
  anchorRoleSummary?: string;
  /** Output language. JSON keys stay English regardless. */
  locale?: Language;
}

export interface BuiltInterviewPrompts {
  system: string;
  user: string;
}

const SCHEMA = `{
  "dualLens": {
    "recruiterHire": { "reasons": ["..."], "signals": ["..."] },
    "recruiterNoHire": { "risks": ["..."], "gaps": ["..."] },
    "candidateHire": { "opportunities": ["..."], "growth": ["..."] },
    "candidateNoHire": { "risks": ["..."], "mismatches": ["..."] }
  },
  "questions": [
    {
      "id": "q1",
      "type": "behavioral | technical | scenario",
      "question": "the question text — medium-hard, anchored to the candidate's experience",
      "rubric": {
        "criteria": "what a competent answer covers (1-2 sentences)",
        "excellentSignals": ["2-5 bullets — what a strong answer demonstrates"],
        "failSignals": ["2-5 bullets — what a weak answer looks like"]
      }
    }
    // ... q2 .. q10
  ]
}`;

const COUNT_RULE =
  'EXACTLY 10 questions in this order: q1-q4 behavioral, q5-q8 technical, q9-q10 scenario. Each q1..q10 unique.';

const truncate = (s: string | undefined, n: number) =>
  !s ? '' : s.length <= n ? s : `${s.slice(0, n - 1)}…`;

export function buildInterviewGenPrompt(inputs: InterviewGenInputs): BuiltInterviewPrompts {
  const {
    mode,
    targetRole,
    jobDescription,
    companyName,
    anchorRoleTitle,
    anchorRoleSummary,
    locale = 'auto',
  } = inputs;

  const langInstr =
    locale === 'vi'
      ? 'Respond in Vietnamese for all human-readable text fields; keep JSON keys English.'
      : locale === 'en'
        ? 'Respond in English.'
        : 'Respond in the candidate CV / role description language; keep JSON keys English.';

  const viRegisterLock =
    locale === 'vi' || locale === 'auto'
      ? '\n- If output is Vietnamese: recruiter-Vietnamese register only. Action verbs (xây dựng, dẫn dắt, triển khai). No honorifics (em xin gửi). No marketing puffery (đầy nhiệt huyết, chuyên gia hàng đầu). Keep proper nouns + tools in English (Spark, React, GCP).'
      : '';

  const system =
    'You are a former Big-Tech senior interviewer + recruiter who has run 1000+ interviews across role families. You produce interview prep artifacts that are honest, calibrated to the candidate\'s real CV experience, and medium-hard (no trivia, no gotchas). Always return ONE valid JSON object matching the requested schema — no commentary, no markdown fences. Never invent candidate experience. Never recycle generic interview questions; anchor each behavioral / scenario question to a specific CV signal.';

  const modeBlock =
    mode === 'job_fit'
      ? `=== TARGET JOB (mode = job_fit) ===
Role: ${targetRole}
Company: ${companyName?.trim() || '(unspecified)'}
JD excerpt:
${truncate(jobDescription, 1500) || '(JD not provided — use role baseline)'}`
      : `=== TARGET ROLE (mode = standalone) ===
Role: ${targetRole}
No specific JD — use industry-standard expectations for this role family.`;

  const user = `Generate Dual Lens analysis + 10 interview questions for this candidate practicing for the target role.

${modeBlock}

=== CANDIDATE CV ANCHOR ROLE ===
Anchor role title: ${anchorRoleTitle}
Anchor role excerpt:
${truncate(anchorRoleSummary, 600) || '(no excerpt provided — infer scope from role title)'}

=== DUAL LENS RULES ===
- recruiterHire: why a recruiter would advance this candidate to the next round. \`reasons\` = CV-evidence statements (what the candidate has done). \`signals\` = transferable strengths visible from CV.
- recruiterNoHire: why a recruiter might pass. \`risks\` = role-vs-CV mismatches. \`gaps\` = missing CV evidence the role expects.
- candidateHire: why the candidate should pursue this role. \`opportunities\` = career upside. \`growth\` = skills/scope the role unlocks.
- candidateNoHire: why the candidate might decline. \`risks\` = personal/career risks. \`mismatches\` = role traits that conflict with the candidate's CV trajectory.
- Each quadrant: 2-5 bullets, ≤140 chars each, concrete, no platitudes.

=== QUESTION RULES ===
- ${COUNT_RULE}
- Medium-hard difficulty — assume the candidate has real experience for the anchor role. No textbook trivia. No leetcode-style algorithm puzzles unless the role itself centers on them.
- Behavioral (q1-q4): anchored to the candidate's actual scope. Use "Tell me about a time when…" style sparingly — prefer "Walk me through how you handled X in your [anchor role] work".
- Technical (q5-q8): role-craft questions. For tech roles ask system design / debugging / trade-off questions. For non-tech roles (sales, marketing, finance) ask role-craft equivalents — pipeline forecasting, campaign attribution, model assumptions, etc. NOT generic CS questions for non-CS roles.
- Scenario (q9-q10): hypothetical situation tied to the target role's pressure points. Include the constraint that makes it hard.
- Rubric per question: \`criteria\` = 1-2 sentence summary of what a competent answer covers. \`excellentSignals\` = 2-5 bullets describing senior-grade indicators. \`failSignals\` = 2-5 bullets describing weak answers (vagueness, missing trade-offs, no metrics, etc.).
- Each question: standalone, self-contained — do not refer to other questions.

=== OUTPUT PARAMS ===
- ${langInstr}${viRegisterLock}
- Return ONLY one valid JSON object matching this schema (no commentary, no markdown fences):
${SCHEMA}`;

  return { system, user };
}
