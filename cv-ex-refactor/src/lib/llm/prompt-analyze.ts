import type { AnalyzeBodyT } from '@/lib/schemas/llm-request';

const SCHEMA = `{
  "detectedRole": "string",
  "summary": "2-3 sentence executive verdict",
  "cvVisibility": "0-100 (how clearly CV shows what's needed)",
  "realExperience": "0-100 (true underlying fit using CV + profile)",
  "risk": "0-100 (recruiter risk; higher = riskier hire)",
  "screeningPass": "0-100 (% chance CV passes first 30s screen as-is)",
  "interviewReadiness": "0-100 (how ready to defend the CV in interview)",
  "atsKeyword": "0-100 (estimated ATS keyword density vs JD)",
  "metrics": [
    { "name": "coreSkill | tool | scope | production | domain | evidence | seniority | impact | communication",
      "score": "0-100 — HOW WELL THE CV MATCHES THE JD ON THIS DIMENSION",
      "reason": "1-sentence explanation citing concrete JD requirement + CV evidence (or lack thereof)" }
  ],
  "strengths": [ { "title": "...", "evidence": "what CV proves", "jdSignal": "JD phrase matched" } ],
  "gaps": [
    { "title": "...", "severity": "critical|moderate|minor",
      "type": "wording|real",
      "recommendation": "what's missing or unclear",
      "fixAction": "specific next step (add bullet, rephrase, upskill)" }
  ],
  "redFlags": [ { "flag": "short flag", "concern": "why recruiter cares" } ],
  "coverage": [
    { "requirement": "JD requirement", "status": "match|partial|missing", "evidence": "quote or phrase" }
  ],
  "recommendations": [ { "title": "...", "action": "concrete step", "priority": "high|medium|low" } ],
  "keywordCoverage": { "matched": ["..."], "partial": ["..."], "missing": ["..."] },
  "suggestedSummaryLine": "1-2 sentence truthful CV summary tailored to JD"
}`;

const DIMENSION_DOCS = [
  ['coreSkill', 'Core competencies the role demands (e.g. distributed-system design, data modeling).'],
  ['tool', 'Concrete tools, platforms, frameworks (e.g. Spark, Airflow, K8s).'],
  ['scope', 'Same kind of scope owned (single team vs cross-org, IC vs lead).'],
  ['production', 'Real production environments — live systems, real users, business-critical.'],
  ['domain', 'Industry/domain context relevant to role (fintech, ad-tech, healthcare…).'],
  ['evidence', 'Concrete proof in CV: project, role, dates, ownership — not buzzwords.'],
  ['seniority', 'Level, years, ownership level, decision-making authority.'],
  ['impact', 'Magnitude of outcomes: metrics, percentage gains, scale, business impact.'],
  ['communication', 'Stakeholder collaboration, team/client communication, business acumen.'],
].map(([k, v]) => `- ${k}: ${v}`).join('\n');

export interface BuiltPrompts {
  system: string;
  user: string;
}

export function buildAnalyzePrompts(body: AnalyzeBodyT): BuiltPrompts {
  const { inputs } = body;
  const {
    jdText,
    jdUrl,
    cvText,
    profileText,
    targetRole,
    strictness,
    language,
    mustHaves,
  } = inputs;

  const langInstr =
    language === 'vi'
      ? 'Respond in Vietnamese for all human-readable text fields; keep JSON keys English.'
      : language === 'auto'
        ? 'Respond in the JD language; keep JSON keys English.'
        : 'Respond in English.';

  const mustHavesBlock = mustHaves.length
    ? mustHaves.map((m, i) => `  ${i + 1}. ${m}`).join('\n')
    : '  (none extracted — apply implicit JD requirements)';

  const system =
    'You are an expert technical recruiter and CV reviewer. Always return ONE valid JSON object matching the requested schema. Be concrete, honest, concise. Never invent candidate experience.';

  const user = `Analyze how well the candidate's CV matches the Job Description. The JD is the ground truth — score each dimension based on what THIS role requires and what the CV evidences.

=== JOB DESCRIPTION ===
${jdUrl ? `Source: ${jdUrl}\n` : ''}${jdText}

=== CANDIDATE CV ===
${cvText}

=== REAL EXPERIENCE PROFILE (extra context — use to distinguish wording-gap vs real-experience-gap) ===
${profileText?.trim() || '(none provided)'}

=== ANALYSIS PARAMETERS ===
- Target role family: ${targetRole}
- Strictness: ${strictness}  (strict = recruiter-grade; friendly = encouraging; balanced = neutral)
- ${langInstr}

=== 9-DIMENSION RUBRIC (each scored 0-100 based on CV match against JD) ===
${DIMENSION_DOCS}

=== MUST-HAVE HARD GATE (recruiter screening floor) ===
${mustHavesBlock}

=== SCORING RULES ===
1. Score each of the 9 metrics 0-100 independently — "how well does the CV evidence match what the JD requires on THIS dimension".
2. If the JD does not emphasize a dimension, score it on baseline expectations for the role (don't punish absence of unrequested signals).
3. If a dimension is irrelevant to this role, score around 50 with reason explaining the irrelevance.
4. Must-have gate: if ANY listed must-have is missing (no evidence in CV or profile), reflect this in the relevant metric score AND raise the matching gap with severity "critical".
5. cv_wording_gap (type=wording): candidate likely has the experience per profile but CV doesn't show it.
6. real_experience_gap (type=real): candidate truly lacks it.
7. Severity: critical = JD must-have & no evidence; moderate = partial / missing nice-to-have; minor = wording polish.
8. Return 4-8 strengths, 4-10 gaps, 0-5 red flags, 4-10 coverage rows, 4-8 recommendations.
9. Be concrete. Reference actual JD/CV phrases.
10. Do NOT invent candidate experience. Score only on provided text.
11. Do NOT output overall score, decision, or decision label — the client computes these from the 9 metric scores.

Return ONLY one valid JSON object (no commentary, no markdown fences) matching this schema:
${SCHEMA}`;

  return { system, user };
}
