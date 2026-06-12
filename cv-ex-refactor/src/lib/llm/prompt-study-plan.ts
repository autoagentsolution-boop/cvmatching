// Post-interview study plan prompt builder.
//
// Input: 10 graded questions + answers + dual lens + target role. The
// LLM clusters the weak Q (score ≤5) into 2-4 themes and proposes 1-2
// real-world courses + 1 free resource per theme.
//
// Token budget:
//   input  ≈ 3.0–3.5k (10 Q + grades + dual lens condensed)
//   output ≈ 1.0–1.5k (themes + courses)
//
// Anti-hallucination:
//   - platforms restricted to a closed enum (see schemas-study-plan.ts)
//   - NO course URLs — only title + platform; users search the title on
//     the named platform themselves (prevents "https://coursera.org/
//     learn/imaginary-course-404" links)

import type { Language } from '@/features/analyze/types';
import type { InterviewQuestion, DualLens, InterviewGrade } from './schemas-interview';

export interface StudyPlanInputs {
  targetRole: string;
  anchorRoleTitle: string;
  /** Graded questions with merged user_answer + grade (post-submit shape). */
  gradedQuestions: Array<InterviewQuestion & { user_answer: string; grade: InterviewGrade }>;
  dualLens: DualLens;
  /** Concrete locale resolved at start time. */
  locale: Language;
}

export interface BuiltStudyPlanPrompts {
  system: string;
  user: string;
}

const PLATFORMS_GLOBAL =
  'coursera, udemy, edx, pluralsight, linkedin-learning, datacamp, oreilly, youtube, freecodecamp';
const PLATFORMS_VN = 'funix, mindx, topcv-academy (Vietnam platforms — prefer when locale=vi)';

const SCHEMA = `{
  "themes": [
    {
      "name": "short theme label (≤80 chars)",
      "why": "1 sentence linking back to interview (cite Q ids + grade reason)",
      "linkedQuestionIds": ["q3", "q7"],
      "courses": [
        {
          "platform": "${PLATFORMS_GLOBAL} | funix | mindx | topcv-academy | other",
          "title": "real-sounding course title — DO NOT include URLs",
          "difficulty": "beginner | intermediate | advanced",
          "estimatedHours": 25
        }
      ],
      "freeResource": {
        "kind": "youtube | docs | book",
        "title": "resource title (channel name / official docs name / 'Title — Author')",
        "summary": "1 sentence what it covers"
      }
    }
    // 2-4 themes total
  ]
}`;

function condenseQuestion(q: InterviewQuestion & { user_answer: string; grade: InterviewGrade }) {
  return `--- ${q.id} (${q.type}, score ${q.grade.score}/10) ---
Q: ${q.question}
Answer: ${q.user_answer.slice(0, 400)}${q.user_answer.length > 400 ? '…' : ''}
Feedback: ${q.grade.feedback}
Improvements: ${q.grade.improvements.join(' | ')}`;
}

function condenseDualLens(dl: DualLens): string {
  const gaps = [
    ...dl.recruiterNoHire.risks,
    ...dl.recruiterNoHire.gaps,
    ...dl.candidateNoHire.mismatches,
  ];
  return gaps.slice(0, 8).map((g) => `- ${g}`).join('\n');
}

export function buildStudyPlanPrompt(inputs: StudyPlanInputs): BuiltStudyPlanPrompts {
  const { targetRole, anchorRoleTitle, gradedQuestions, dualLens, locale } = inputs;
  const lang: 'vi' | 'en' = locale === 'en' ? 'en' : 'vi';
  const langName = lang === 'vi' ? 'Vietnamese' : 'English';

  // Highlight the weak Q (score ≤5) so the LLM focuses cluster attention
  // there. Strong Q (≥6) still included briefly so context is complete.
  const weakQs = gradedQuestions.filter((q) => q.grade.score <= 5);
  const strongQs = gradedQuestions.filter((q) => q.grade.score >= 6);

  const platformsLine =
    lang === 'vi'
      ? `${PLATFORMS_GLOBAL}; ALSO mention ${PLATFORMS_VN}`
      : PLATFORMS_GLOBAL;

  const system = `You are a senior interview coach + curriculum designer. After a candidate finishes a practice interview, you cluster their weak answers into 2-4 learning themes and recommend a tight study plan — 1-2 real online courses + 1 free resource per theme. Always return ONE valid JSON object matching the requested schema — no commentary, no markdown fences. Never fabricate course URLs; only return platform + title so the candidate can search.

OUTPUT LANGUAGE: ${langName}. theme.name, theme.why, course.title (when not a brand-name course), freeResource.title + summary — all in ${langName}. JSON keys + enum values + course brand names (e.g. "System Design Interview" remains English if that's the actual course brand) stay as-is.`;

  const user = `Build a study plan from this candidate's graded practice interview. Cluster their WEAK answers (score ≤5) into 2-4 themes, then recommend courses + free resources.

=== OUTPUT LANGUAGE — STRICT ===
Write theme.name, theme.why, freeResource.title + summary, and course.title (when the course is not a well-known English-language brand) in ${langName}. JSON keys + course brand names stay English. ${
    lang === 'vi'
      ? 'When suggesting Vietnamese platforms (funix, mindx, topcv-academy), course titles should be Vietnamese if those platforms commonly publish in VN; otherwise keep brand names verbatim.'
      : ''
  }

=== TARGET ROLE ===
${targetRole}
Anchor CV role: ${anchorRoleTitle}

=== WEAK QUESTIONS (score ≤ 5) — primary input for clustering ===
${weakQs.length > 0 ? weakQs.map(condenseQuestion).join('\n\n') : '(no weak questions — candidate scored ≥6 on every question. Cluster around the lowest-scoring themes regardless.)'}

=== STRONG QUESTIONS (score ≥ 6) — context only, do NOT cluster these ===
${strongQs.length > 0 ? strongQs.map((q) => `${q.id} (${q.type}, ${q.grade.score}/10): ${q.question.slice(0, 120)}…`).join('\n') : '(none)'}

=== RECRUITER + CANDIDATE CONCERN BULLETS ===
${condenseDualLens(dualLens)}

=== CLUSTERING RULES ===
- 2-4 themes total. NEVER fewer than 2 (always offer breadth), NEVER more than 4 (avoid analysis paralysis).
- Each theme groups 1+ weak Q by shared underlying skill (e.g. "System Design Trade-offs" covers Q3 + Q7 if both are about scaling decisions).
- linkedQuestionIds MUST be a subset of weak Q ids when weak Q exist; otherwise pick from strong Q.
- theme.why is ONE sentence citing concrete grade reasons ("Q3 + Q7 lost points on missing trade-off discussion").

=== COURSE RULES ===
- 1-2 courses per theme. Prefer 1 well-targeted course over 2 mediocre ones.
- Platform from this list ONLY: ${platformsLine}, or "other" for niche.
- Title must be a real-sounding course title — recall actual courses you know exist (e.g. "System Design Interview by Alex Xu" / "Designing Data-Intensive Applications" book). Do NOT fabricate titles like "Advanced X Mastery 2024".
- NEVER output a URL. Just platform + title. The user will search themselves.
- estimatedHours: realistic. 4-40h typical for a focused course. Cap 200h.
- difficulty: match the candidate's anchor role level (their CV shows their bar).

=== FREE RESOURCE RULES ===
- Exactly 1 per theme. Kind = youtube | docs | book ONLY (community-vetted sources — generic blogs / podcasts are not allowed because they're easy to fabricate).
- For YouTube → channel or playlist name from a creator with verified audience (e.g. "ByteByteGo system design playlist", "Fireship 100 seconds of code", "freeCodeCamp full courses"). Do NOT invent channel names.
- For docs → OFFICIAL documentation from named platforms only (e.g. "PostgreSQL documentation", "React official docs", "AWS Well-Architected whitepapers"). NOT random tutorial blogs.
- For book → "Title — Author" of a well-known published book (e.g. "Designing Data-Intensive Applications — Martin Kleppmann"). Books have zero hours cost so list them when relevant even if dense.
- summary: 1 sentence what the candidate gets from it.

Return ONLY one valid JSON object matching this schema (no commentary, no markdown fences):
${SCHEMA}`;

  return { system, user };
}
