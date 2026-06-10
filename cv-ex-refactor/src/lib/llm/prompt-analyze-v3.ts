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
// 2026-06-10 Phase 1b polish:
//   - 4-anchor calibration table per dimension (30 / 60 / 85 / 95) to
//     reduce flash-model score drift across runs (audit § 1 rec #1).
//   - Recruiter persona ("former Big-Tech recruiter, screened 5000+ CVs").
//   - Lock detectedRole — must echo input role verbatim; CV/role mismatch
//     surfaces via summary + gap, never via silent re-labeling.
//   - Vietnamese register block — recruiter-Vietnamese action verbs only.
//
// See plans/260604-1356-v04-cv-solo-analyze-pivot/phase-01-scoring-prompt-rewrite.md
// + plans/reports/audit-260609-1539-llm-prompts.md § 1.

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
  /**
   * Server-supplied "today" so the LLM doesn't reason about date validity
   * against its training-cutoff snapshot. Required to avoid hallucinated
   * "Mar 2026 is in the future" warnings when the candidate's current role
   * has a 2026 end date but today is actually past it. ISO yyyy-mm-dd.
   */
  todayIso?: string;
}

export interface BuiltPromptsV3 {
  system: string;
  user: string;
}

const SCHEMA = `{
  "detectedRole": "string — MUST echo the input role verbatim",
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

// 4-anchor calibration table per dimension. Pins the 30 / 60 / 85 / 95
// score-points to concrete behaviors so flash output stays stable across
// runs (was ±15 pre-anchor). Anchors are role-agnostic — the LLM
// translates per role family.
const DIMENSION_DOCS_V3 = [
  ['coreSkill',
    'Core competencies the role demands — the actual craft (system design for tech, pipeline ownership for sales, campaign strategy for marketing, etc.). Does the CV evidence these at the role baseline?',
    '30 = lists tools without context | 60 = uses with simple context | 85 = solves real problems with them | 95 = teaches others / sets the standard'],
  ['tool',
    'Tools, platforms, methodologies expected for the role (CRM for sales, frameworks for tech, design suites for designers, BI tools for analysts…). Are they named with real usage context?',
    '30 = name-drops a few tools | 60 = uses 2-3 standard tools at baseline | 85 = uses the right tool deeply for the role | 95 = polyglot, picks tool by tradeoff'],
  ['scope',
    'Ownership scope — IC vs lead, single team vs cross-org, deal size for sales, territory size, project budget. Does the CV match the role\'s level?',
    '30 = scope unclear or sub-role | 60 = owned one component / small territory | 85 = led multi-team / multi-region effort | 95 = strategic org-wide ownership'],
  ['production',
    'Real-world delivery context — production systems for tech, signed deals / shipped campaigns / launched products for non-tech. Evidenced or hypothetical?',
    '30 = projects/coursework only | 60 = some production exposure | 85 = consistent production ownership | 95 = mission-critical at scale'],
  ['domain',
    'Industry / vertical context relevant to the role (fintech, ad-tech, healthcare, education, government…). Demonstrates depth or generic?',
    '30 = no relevant industry | 60 = adjacent industry | 85 = direct industry experience | 95 = recognized domain expert'],
  ['evidence',
    'Concrete proof: project name, role, dates, ownership, deliverable — not buzzwords. Strong for the role?',
    '30 = vague phrasing, no proof | 60 = role + duration + general scope | 85 = named projects + measurable scope | 85+ specific outcomes per role | 95 = portfolio-grade evidence'],
  ['seniority',
    'Level, years of relevant experience, decision-making authority, headcount/budget owned. Does the CV demonstrate the claimed seniority?',
    '30 = below stated seniority bar | 60 = matches seniority on paper | 85 = exceeds bar with proof | 95 = principal/staff-level signals'],
  ['impact',
    'Magnitude of outcomes — quantified where possible (revenue, %, headcount affected, NPS shift, latency reduced, eng-time saved). Strong for the role?',
    '30 = no metrics | 60 = some quantified bullets | 85 = consistent metric-led outcomes | 95 = outsized / industry-noticed impact'],
  ['communication',
    'Stakeholder collaboration, cross-functional partnership, client/customer-facing comms, written/spoken proof. Evidenced for the role?',
    '30 = no comms evidence | 60 = standard team comms | 85 = cross-functional + external proof | 95 = recognized writer / speaker'],
].map(([k, v, anchors]) => `- ${k}: ${v}\n  Anchors: ${anchors}`).join('\n');

export function buildAnalyzeV3Prompts(inputs: AnalyzeV3Inputs): BuiltPromptsV3 {
  const { cvText, role, language = 'auto', profileText, todayIso } = inputs;

  const langInstr =
    language === 'vi'
      ? 'Respond in Vietnamese for all human-readable text fields; keep JSON keys English.'
      : language === 'auto'
        ? 'Respond in the CV language; keep JSON keys English.'
        : 'Respond in English.';

  // Recruiter-Vietnamese register block — keeps human-text fields tight
  // (action verbs, no "em xin gửi", no marketing puffery). Only injected
  // when the output is going to be Vietnamese.
  const viRegisterLock =
    language === 'vi' || language === 'auto'
      ? '\n- If output is Vietnamese: recruiter-Vietnamese register only. Action verbs (xây dựng, dẫn dắt, triển khai). No honorifics (em xin gửi). No marketing puffery (đầy nhiệt huyết, chuyên gia hàng đầu). Keep proper nouns in English (Spark, React, GCP).'
      : '';

  const system =
    'You are a former Big-Tech recruiter who has screened 5000+ CVs across role families. You score CVs intrinsically against the candidate\'s claimed role using industry-standard role baselines — you are NOT comparing against any specific JD. Always return ONE valid JSON object matching the requested schema. Be concrete, honest, concise. Never invent candidate experience. Never fabricate quantitative outcomes the CV does not state.';

  const user = `Evaluate the candidate's CV for the claimed role. Use industry-standard expectations for that role as the baseline — there is no JD. Score each dimension based on what THIS role typically requires and what the CV evidences.

=== TODAY'S DATE (server time) ===
${todayIso ?? '(unknown — treat all CV dates as historical unless clearly future)'}
Use this to judge whether CV dates are past / current / future. Do NOT assume today is your training-cutoff date — a "Mar 2026" end date may be in the past relative to TODAY.

=== CANDIDATE'S CLAIMED ROLE ===
${role}

=== CANDIDATE CV ===
${cvText}

=== REAL EXPERIENCE PROFILE (extra context — use to distinguish wording-gap vs real-experience-gap) ===
${profileText?.trim() || '(none provided)'}

=== ANALYSIS PARAMETERS ===
- ${langInstr}${viRegisterLock}

=== 9-DIMENSION RUBRIC (each scored 0-100 against role baseline) ===
Each dimension lists its definition + 4 calibration anchors. Use the
anchors as your reference points — score between them based on observed
CV evidence. Avoid clustering around mid-50s; commit to the anchor that
best matches.
${DIMENSION_DOCS_V3}

=== SCORING RULES ===
1. Score each of the 9 metrics 0-100 independently — anchor to the closest match from the 4-point rubric for that dimension.
2. Use ROLE BASELINE as the reference, not a specific JD. Example: for "Senior Backend Engineer" baseline ~ Node/Python + cloud + system design + 5+ yrs.
3. If a dimension is genuinely irrelevant for the role, score around 50 with reason explaining the irrelevance.
4. cv_wording_gap (type=wording): candidate likely has the experience per profile but CV doesn't show it clearly.
5. real_experience_gap (type=real): candidate truly lacks it relative to role baseline.
6. Severity: critical = blocking missing capability for the role; moderate = noticeable weakness; minor = wording polish.
7. Return 4-8 strengths, 4-10 gaps, 0-5 red flags, 4-8 recommendations.
8. atsKeyword: score the CV's coverage of industry-standard keywords for the role (not vs any single JD). keywordCoverage arrays list which role-baseline keywords are matched / partial / missing in the CV.
9. detectedRole MUST echo the input role verbatim. If the CV strongly suggests a different role-track (e.g. CV reads Data Engineer but input role is ML Engineer), mention the disagreement in \`summary\` and raise a moderate-severity gap describing the mismatch — never silently re-label detectedRole.
10. Do NOT invent candidate experience. Score only on the provided CV + profile text.
11. Do NOT output overallScore or decision/decisionLabel — the client computes those from the 9 metric scores.
12. Do NOT include a 'coverage' array — there is no JD to cover. (The field is dropped in v3.)

Return ONLY one valid JSON object (no commentary, no markdown fences) matching this schema:
${SCHEMA}`;

  return { system, user };
}
