import type { ExtractMustHavesBodyT } from '@/lib/schemas/llm-request';

export interface BuiltMustHavePrompts {
  system: string;
  user: string;
}

export function buildMustHavePrompts(body: ExtractMustHavesBodyT): BuiltMustHavePrompts {
  const langInstr =
    body.language === 'vi'
      ? 'Return requirements in Vietnamese when JD is Vietnamese; otherwise keep original language.'
      : body.language === 'auto'
        ? 'Keep requirements in the JD\'s original language.'
        : 'Return requirements in English.';

  const system =
    'You extract hard-gate requirements from job descriptions. Always return ONE valid JSON object.';

  const user = `Extract every concrete requirement and qualification from the JD below — items a recruiter would screen on. Be exhaustive.

Rules:
- Extract typically 5-12 items, more if the JD lists many. Do not artificially cap.
- Include: years of experience, specific tools / frameworks / languages, certifications, education level, role-specific technical skills, domain experience, leadership / scope responsibilities, location/work-mode if stated as hard, language proficiency.
- KEEP "preferred" / "nice-to-have" items when the JD names them concretely — recruiters score on them.
- Skip: pure company perks, vague soft-skill platitudes ("passionate", "team player") with no measurable signal.
- Split compound items: "5+ years with Python, SQL, Spark" → 3 items.
- Each item ≤ 200 chars, no leading bullets / numbers / prefixes.
- Deduplicate near-identical items.
- ${langInstr}

Return ONLY one valid JSON object: { "mustHaves": ["...", "...", ...] }

=== JOB DESCRIPTION ===
${body.jdText}`;

  return { system, user };
}
