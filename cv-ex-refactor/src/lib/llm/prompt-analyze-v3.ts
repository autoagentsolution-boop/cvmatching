// v0.4 CV-Solo Analyze prompt builder.
//
// Replaces prompt-analyze.ts (v2 CV-vs-JD model) with a CV-intrinsic prompt
// scoped to a user-claimed role. The LLM no longer compares the CV against
// a JD — instead it scores how well the CV evidences each of 9 recruiter
// dimensions FOR the claimed role.
//
// Output JSON shape is intentionally backward-compatible with normalize-
// analysis.ts so the UI (sliders, recommendations, gaps, keywords, red
// flags) renders without changes. Three v2-specific fields are dropped:
//   - `coverage` (JD-requirement coverage) — meaningless without a JD
//   - `strengths[].jdSignal` — drops the JD-phrase attribution
//   - must-have hard gate — relocated to Job Fit detail per the v0.4 plan
//
// See plans/260604-1356-v04-cv-solo-analyze-pivot/phase-01-scoring-prompt-rewrite.md

import type { Language } from '@/features/analyze/types';

export interface AnalyzeV3Inputs {
  /** Candidate CV text. */
  cvText: string;
  /** Role the candidate is targeting — either LLM-inferred or user-confirmed. */
  role: string;
  /** Response language for human-readable fields; JSON keys stay English. */
  language?: Language;
  /** Optional candidate notes / real-experience profile (same role as v2). */
  profileText?: string;
}

export interface BuiltPromptsV3 {
  system: string;
  user: string;
}

const SCHEMA = `{
  "detectedRole": "string — confirmed canonical role title",
  "summary": "2-3 sentence executive verdict on CV quality for the role",
  "cvVisibility": "0-100 — how clearly the CV shows what the role needs",
  "realExperience": "0-100 — true underlying depth for the role using CV + profile",
  "risk": "0-100 — recruiter risk (higher = riskier hire for this role)",
  "screeningPass": "0-100 — % chance the CV passes a 30s recruiter screen for THIS role",
  "interviewReadiness": "0-100 — how ready candidate is to defend the CV in interview for THIS role",
  "atsKeyword": "0-100 — keyword density vs industry baseline for the role (NOT vs a JD)",
  "metrics": [
    { "name": "coreSkill | tool | scope | production | domain | evidence | seniority | impact | communication",
      "score": "0-100 — HOW WELL THE CV EVIDENCES THIS DIMENSION FOR THE CLAIMED ROLE",
      "reason": "1-sentence explanation citing CV evidence + the role-baseline expectation" }
  ],
  "strengths": [ { "title": "...", "evidence": "what the CV proves" } ],
  "gaps": [
    { "title": "...", "severity": "critical|moderate|minor",
      "type": "wording|real",
      "recommendation": "what's missing or unclear",
      "fixAction": "specific next step (add bullet, rephrase, upskill)" }
  ],
  "redFlags": [ { "flag": "short flag", "concern": "why recruiter cares for this role" } ],
  "recommendations": [ { "title": "...", "action": "concrete step", "priority": "high|medium|low" } ],
  "keywordCoverage": { "matched": ["..."], "partial": ["..."], "missing": ["..."] },
  "suggestedSummaryLine": "1-2 sentence truthful CV summary tailored to the role"
}`;

const DIMENSION_DOCS_V3 = [
  ['coreSkill', 'Core competencies the role demands. Does the CV demonstrate these for the role baseline?'],
  ['tool', 'Concrete tools / platforms / frameworks expected for the role. Are they evidenced?'],
  ['scope', 'Scope owned (IC vs lead, team vs cross-org). Does the CV match the role\'s level?'],
  ['production', 'Real production environments — live systems, real users. Evidenced for the role?'],
  ['domain', 'Industry / domain context relevant to the role. Demonstrates depth or generic?'],
  ['evidence', 'Concrete proof: project, role, dates, ownership — not buzzwords. Strong for the role?'],
  ['seniority', 'Level, years, ownership, decision-making. Does CV demonstrate the claimed seniority?'],
  ['impact', 'Magnitude of outcomes: metrics, percentages, scale, business impact. Strong for the role?'],
  ['communication', 'Stakeholder collaboration, team/client communication. Evidenced for the role?'],
].map(([k, v]) => `- ${k}: ${v}`).join('\n');

export function buildAnalyzeV3Prompts(inputs: AnalyzeV3Inputs): BuiltPromptsV3 {
  const { cvText, role, language = 'auto', profileText } = inputs;

  const langInstr =
    language === 'vi'
      ? 'Respond in Vietnamese for all human-readable text fields; keep JSON keys English.'
      : language === 'auto'
        ? 'Respond in the CV language; keep JSON keys English.'
        : 'Respond in English.';

  const system =
    'You are an expert technical recruiter and CV reviewer. Score CVs intrinsically against the candidate\'s claimed role using industry-standard role baselines — you are NOT comparing against any specific JD. Always return ONE valid JSON object matching the requested schema. Be concrete, honest, concise. Never invent candidate experience. Never fabricate quantitative outcomes the CV does not state.';

  const user = `Evaluate the candidate's CV for the claimed role. Use industry-standard expectations for that role as the baseline — there is no JD. Score each dimension based on what THIS role typically requires and what the CV evidences.

=== CANDIDATE'S CLAIMED ROLE ===
${role}

=== CANDIDATE CV ===
${cvText}

=== REAL EXPERIENCE PROFILE (extra context — use to distinguish wording-gap vs real-experience-gap) ===
${profileText?.trim() || '(none provided)'}

=== ANALYSIS PARAMETERS ===
- ${langInstr}

=== 9-DIMENSION RUBRIC (each scored 0-100 against role baseline) ===
${DIMENSION_DOCS_V3}

=== SCORING RULES ===
1. Score each of the 9 metrics 0-100 independently — "how well does the CV evidence this dimension for what the role typically requires".
2. Use ROLE BASELINE as the reference, not a specific JD. Example: for "Senior Backend Engineer" baseline ~ Node/Python + cloud + system design + 5+ yrs.
3. If a dimension is genuinely irrelevant for the role, score around 50 with reason explaining the irrelevance.
4. cv_wording_gap (type=wording): candidate likely has the experience per profile but CV doesn't show it clearly.
5. real_experience_gap (type=real): candidate truly lacks it relative to role baseline.
6. Severity: critical = blocking missing capability for the role; moderate = noticeable weakness; minor = wording polish.
7. Return 4-8 strengths, 4-10 gaps, 0-5 red flags, 4-8 recommendations.
8. atsKeyword: score the CV's coverage of industry-standard keywords for the role (not vs any single JD). keywordCoverage arrays list which role-baseline keywords are matched / partial / missing in the CV.
9. detectedRole: echo back the canonical role title you actually evaluated against (may differ slightly from input if the CV strongly suggests a refinement; explain refinement in summary).
10. Do NOT invent candidate experience. Score only on the provided CV + profile text.
11. Do NOT output overallScore or decision/decisionLabel — the client computes those from the 9 metric scores.
12. Do NOT include a 'coverage' array — there is no JD to cover. (The field is dropped in v3.)

Return ONLY one valid JSON object (no commentary, no markdown fences) matching this schema:
${SCHEMA}`;

  return { system, user };
}
