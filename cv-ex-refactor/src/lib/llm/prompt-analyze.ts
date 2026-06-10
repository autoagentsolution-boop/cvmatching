import type { AnalyzeBodyT } from '@/lib/schemas/llm-request';

// 2026-06-10 Phase 1b polish:
//   - strictness tiered into score-deltas (was tone-only, ineffective).
//     'friendly' dropped — was grade inflation; type narrowed to
//     'balanced' | 'strict'.
//   - Coverage rows must NOT duplicate must-haves — distinct JD signals.
//   - Step-0 JD industry tagging — anchors `domain` dimension to inferred
//     vertical (fintech / ad-tech / healthcare / etc).
//   - New `roleAlignment` field — flags track mismatch (Backend candidate
//     vs ML JD) so the score isn't silently misread.
//   - Vietnamese register block — recruiter-Vietnamese register only.
//
// See plans/reports/audit-260609-1539-llm-prompts.md § 2.

const SCHEMA = `{
  "detectedRole": "string",
  "summary": "2-3 sentence executive verdict (include inferred JD industry)",
  "cvVisibility": "0-100 (how clearly CV shows what's needed)",
  "realExperience": "0-100 (true underlying fit using CV + profile)",
  "risk": "0-100 (recruiter risk; higher = riskier hire)",
  "screeningPass": "0-100 (% chance CV passes first 30s screen as-is)",
  "interviewReadiness": "0-100 (how ready to defend the CV in interview)",
  "atsKeyword": "0-100 (estimated ATS keyword density vs JD)",
  "roleAlignment": {
    "aligned": "boolean — true when candidate's CV role-track matches JD's target role-track",
    "note": "empty string when aligned=true; 1-line description of the track mismatch when aligned=false"
  },
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
    { "requirement": "JD signal BEYOND must-haves", "status": "match|partial|missing", "evidence": "quote or phrase" }
  ],
  "recommendations": [ { "title": "...", "action": "concrete step", "priority": "high|medium|low" } ],
  "keywordCoverage": { "matched": ["..."], "partial": ["..."], "missing": ["..."] },
  "suggestedSummaryLine": "1-2 sentence truthful CV summary tailored to JD"
}`;

// Universal dimension descriptions — same set as prompt-analyze-v3 so a CV
// scored under CV-solo and CV-vs-JD reads the same labels. See v3 file for
// the full rationale on keeping internal keys (coreSkill/tool/production)
// while broadening the prompt + UI text to non-tech roles.
const DIMENSION_DOCS = [
  ['coreSkill', 'Core competencies the role demands — the actual craft (system design for tech, pipeline ownership for sales, campaign strategy for marketing). Does the CV evidence these at the role baseline?'],
  ['tool', 'Tools, platforms, methodologies expected for the role (CRM for sales, frameworks for tech, design suites for designers, BI tools for analysts). Are they named with real usage context?'],
  ['scope', 'Ownership scope — IC vs lead, single team vs cross-org, deal size for sales, territory size, project budget. Does the CV match the role\'s level?'],
  ['production', 'Real-world delivery context — production systems for tech, signed deals / shipped campaigns / launched products for non-tech.'],
  ['domain', 'Industry / vertical context relevant to the role (fintech, ad-tech, healthcare, education, government).'],
  ['evidence', 'Concrete proof: project name, role, dates, ownership, deliverable — not buzzwords.'],
  ['seniority', 'Level, years of relevant experience, decision-making authority, headcount/budget owned.'],
  ['impact', 'Magnitude of outcomes — quantified where possible (revenue, %, headcount affected, NPS shift, latency reduced).'],
  ['communication', 'Stakeholder collaboration, cross-functional partnership, client-facing comms, written/spoken proof.'],
].map(([k, v]) => `- ${k}: ${v}`).join('\n');

// Strictness is now a numeric-delta knob, not a tone. flash interpreted
// the prior "friendly = encouraging" wording as voice, not calibration —
// so strict and balanced produced near-identical scores. Tiered now.
const STRICTNESS_INSTR: Record<'balanced' | 'strict', string> = {
  balanced: 'Strictness: balanced. Report your honest intuition for each dim score as-is. No inflation, no deflation.',
  strict: 'Strictness: strict. After deciding your intuition for each dim, subtract ~10 points before recording. Reserve 85+ for unambiguous evidence; 60s become 50s when proof is one-sided. Recruiter-grade calibration.',
};

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

  const viRegisterLock =
    language === 'vi' || language === 'auto'
      ? '\n- If output is Vietnamese: recruiter-Vietnamese register only. Action verbs (xây dựng, dẫn dắt, triển khai). No honorifics (em xin gửi). No marketing puffery. Keep proper nouns in English (Spark, React, GCP).'
      : '';

  const mustHavesBlock = mustHaves.length
    ? mustHaves.map((m, i) => `  ${i + 1}. ${m}`).join('\n')
    : '  (none extracted — apply implicit JD requirements)';

  const system =
    'You are an expert technical recruiter and CV reviewer. Always return ONE valid JSON object matching the requested schema. Be concrete, honest, concise. Never invent candidate experience.';

  const user = `Analyze how well the candidate's CV matches the Job Description. The JD is the ground truth — score each dimension based on what THIS role requires and what the CV evidences.

=== STEP 0 — IDENTIFY JD INDUSTRY ===
Before scoring, identify the JD's industry / vertical (fintech, ad-tech, healthtech, e-commerce, gaming, government, education, logistics, manufacturing, telecom, etc.). Use this as the baseline for the \`domain\` dimension and mention the inferred industry in the \`summary\` field. If the JD is industry-neutral / staffing-firm style, state "generic" in summary and weight \`domain\` accordingly.

=== JOB DESCRIPTION ===
${jdUrl ? `Source: ${jdUrl}\n` : ''}${jdText}

=== CANDIDATE CV ===
${cvText}

=== REAL EXPERIENCE PROFILE (extra context — use to distinguish wording-gap vs real-experience-gap) ===
${profileText?.trim() || '(none provided)'}

=== ANALYSIS PARAMETERS ===
- Target role family: ${targetRole}
- ${STRICTNESS_INSTR[strictness as 'balanced' | 'strict']}
- ${langInstr}${viRegisterLock}

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
8. Coverage rows: return 4-10. mustHaves above are recruiter-screen gates — DO NOT duplicate them as coverage. Coverage rows surface JD signals BEYOND must-haves (preferred-but-not-required skills, soft signals, scope hints, culture cues).
9. Be concrete. Reference actual JD/CV phrases.
10. Do NOT invent candidate experience. Score only on provided text.
11. Do NOT output overall score, decision, or decision label — the client computes these from the 9 metric scores.
12. Compute \`roleAlignment\`: compare the candidate's CV role-track to the JD's target role. \`aligned=false\` when tracks differ meaningfully (e.g. Backend Engineer CV applying to ML Engineer JD; Marketing CV vs Product Manager JD). When false, write a 1-line \`note\` explaining the gap and mention it in \`summary\`. Score honestly regardless — don't artificially deflate just because aligned=false.

Return ONLY one valid JSON object (no commentary, no markdown fences) matching this schema:
${SCHEMA}`;

  return { system, user };
}
