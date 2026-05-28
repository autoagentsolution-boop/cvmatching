import type { SuggestPathsBodyT } from '@/lib/schemas/llm-request';

const SCHEMA = `{
  "suggestions": [
    {
      "title": "string — concrete role/path title (e.g. 'Staff Data Engineer', 'Engineering Manager', 'ML Platform Lead')",
      "trajectory": "specialist | leadership | pivot | breadth",
      "rationale": "1-2 sentences — what in the CV makes this a natural next step",
      "growthAreas": ["2-3 short skill/experience labels the candidate needs to develop"],
      "fitScore": "0-100 — how close they are today to that path"
    }
  ]
}`;

export interface BuiltSuggestPrompts {
  system: string;
  user: string;
}

export function buildSuggestPathsPrompts(body: SuggestPathsBodyT): BuiltSuggestPrompts {
  const { inputs } = body;
  const { cvText, analysisSummary, currentRole, language } = inputs;

  const langInstr =
    language === 'vi'
      ? 'Respond in Vietnamese for all human-readable text fields; keep JSON keys English.'
      : language === 'auto'
        ? 'Respond in the CV language; keep JSON keys English.'
        : 'Respond in English.';

  const system =
    'You are a senior career coach. Given a CV, propose 3-5 concrete career paths the candidate could realistically pursue. Cover a spread: deeper specialization, leadership track, adjacent pivot, breadth. Return ONE valid JSON object. Be concrete and grounded in CV evidence.';

  const user = `Suggest 3-5 distinct career paths this candidate could pursue. Each suggestion is a path the user might click to expand into a full roadmap, so titles must be specific and actionable (not generic like "growth role").

=== CV ===
${cvText}

${analysisSummary ? `=== PRIOR ANALYSIS SUMMARY ===\n${analysisSummary}\n` : ''}${currentRole ? `=== CURRENT ROLE (detected) ===\n${currentRole}\n` : ''}
=== INSTRUCTIONS ===
1. Read the CV. Identify strengths, seniority, signature work, domain.
2. Propose 3-5 paths covering DIFFERENT trajectories — at least one specialist, one leadership/IC-lead, and either a pivot or breadth move. Do NOT propose 5 variations of the same direction.
3. Each title must be a real role title someone could put on a CV (not a hedge phrase). Examples: "Staff Data Engineer", "Engineering Manager — Data", "ML Platform Tech Lead", "Solutions Architect (Data Mesh)", "Founding Engineer — Data Infra startup".
4. growthAreas: 2-3 short labels (e.g. "system design at scale", "people management fundamentals", "cloud cost optimization"). No fluff.
5. fitScore: honest estimate of current readiness. Specialist deepening is usually highest; pivots are lower.
6. Order suggestions by fitScore descending.
7. ${langInstr}

Return JSON ONLY matching this schema (no markdown, no commentary):
${SCHEMA}`;

  return { system, user };
}
