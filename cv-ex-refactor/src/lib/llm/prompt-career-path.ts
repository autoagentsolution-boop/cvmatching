// Career-path roadmap prompt builder.
//
// 2026-06-10 Phase 2 polish (audit § 5). Operator decision: KEEP
// gemini-flash-latest (no model bump). Prompt-only improvements:
//   - Few-shot Staff-Engineer example anchors specificity.
//   - Optional industry anchor field → milestones/skillGaps must be
//     vertical-specific (fintech → KYC, e-commerce → cache invalidation).
//   - Specificity rubric for skillGap.howToLearn (course + project +
//     timeline).
//   - Drop gentleAdvice softness → structured ambitionGap +
//     requiredSteps (honest by design, no patronizing leak).
//   - quickWins as {action, effortHours, outcome} triples.
//   - alternativePaths lower bound ≥1.

import type { CareerPathBodyT } from '@/lib/schemas/llm-request';
import { FOCUS_AREA_LABELS } from '@/features/career-path/types';

const SCHEMA = `{
  "feasibility": {
    "realistic": "boolean — true if the aspiration is achievable from the CV within the horizon; false if it would require an unreasonable leap",
    "reasons": ["1-3 short, specific reasons referencing CV evidence — empty array when realistic"],
    "ambitionGap": "string — 1-sentence factual gap statement when realistic=false (no patronizing softener, no praise); empty string when realistic",
    "requiredSteps": ["2-4 concrete steps to bridge the gap when realistic=false; empty array when realistic"],
    "pragmaticAlternative": "optional string — a concrete, achievable target the candidate could pursue instead, if realistic=false"
  },
  "currentSnapshot": {
    "detectedRole": "string — current role/level inferred from CV",
    "yearsExperience": "number (optional, integer) — total years inferred",
    "coreStrengths": ["3-5 short strength labels"],
    "signatureProjects": ["1-3 standout projects/initiatives, 1 line each"]
  },
  "targetRole": {
    "title": "string — concrete target role title (must reflect user aspiration)",
    "rationale": "2-3 sentences why this fits given CV + aspiration",
    "fitScore": "0-100 — how close candidate is today to that target"
  },
  "milestones": [
    {
      "yearOffset": "number (e.g. 0.5, 1, 2, 3, 5) — must monotonically increase",
      "title": "string — milestone title",
      "role": "string — role/level at this milestone",
      "responsibilities": ["2-4 owned responsibilities"],
      "skillsToBuild": ["2-5 specific skills"],
      "evidenceToShow": ["2-4 concrete portfolio/CV proof items — name the artifact + how it'd be presented on a CV"],
      "certifications": ["0-2 optional certs/courses"]
    }
  ],
  "skillGaps": [
    {
      "skill": "string — concrete skill name",
      "importance": "high|medium|low",
      "currentLevel": "none|basic|intermediate|advanced|expert",
      "targetLevel": "none|basic|intermediate|advanced|expert",
      "howToLearn": "string — MUST contain ALL 3: (1) course OR book OR mentor, (2) project OR repo OR shippable artifact, (3) timeline (weeks/months)"
    }
  ],
  "alternativePaths": [
    {
      "title": "string — alternative direction label",
      "rationale": "1-2 sentences why it could fit",
      "pivotSteps": ["2-4 high-level steps"]
    }
  ],
  "quickWins": {
    "days30": [{ "action": "string verb-led ≤80 chars", "effortHours": "integer 1-40", "outcome": "1 line — expected result" }],
    "days60": [{ "action": "...", "effortHours": "...", "outcome": "..." }],
    "days90": [{ "action": "...", "effortHours": "...", "outcome": "..." }]
  },
  "caveats": "optional string — honest limits / assumptions"
}`;

// Few-shot example — embedded in SYSTEM_PROMPT under "for STYLE — do not
// copy verbatim". Concrete artifacts + course+project+timeline pattern
// for skillGaps + effortHours triples for quickWins.
const FEW_SHOT_EXAMPLE = `=== STYLE EXAMPLE (a high-quality Senior Backend → Staff Engineer @ fintech roadmap — for STYLE reference only, DO NOT copy verbatim) ===
{
  "feasibility": { "realistic": true, "reasons": [], "ambitionGap": "", "requiredSteps": [], "pragmaticAlternative": null },
  "targetRole": { "title": "Staff Engineer (Payments Platform)", "rationale": "5 yrs production ownership of high-traffic payment systems + cross-team design reviews map cleanly to fintech staff bar; remaining gap is org-wide tech strategy proof.", "fitScore": 72 },
  "milestones": [
    { "yearOffset": 0.5, "title": "Earn 'principal IC' visibility", "role": "Senior Backend Engineer (designated platform owner)",
      "responsibilities": ["Lead cross-team design review for the new ledger service", "Co-own the team's 2027 SRE budget"],
      "skillsToBuild": ["Distributed ledger consistency models", "Audit-trail compliance with VN SBV regulations"],
      "evidenceToShow": ["Production-grade rate-limiter library used by 3 teams + blog post on its design", "Authored design doc for ledger refactor signed off by 2 staff engineers"] },
    { "yearOffset": 1.5, "title": "Org-wide platform impact", "role": "Lead Engineer, Payments Platform",
      "responsibilities": ["Drive consolidation of 3 disparate payment integrations", "Mentor 2 mid-level engineers to senior bar"],
      "skillsToBuild": ["Inter-team migration sequencing", "RFC-driven decision making"],
      "evidenceToShow": ["Reduced PSP integration cost from 4 weeks → 5 days via shared SDK", "RFC adopted as canonical payment-integration pattern across the org"] }
  ],
  "skillGaps": [
    { "skill": "Distributed consistency reasoning", "importance": "high", "currentLevel": "intermediate", "targetLevel": "advanced",
      "howToLearn": "Read DDIA chapters 6-8 + implement a sharded payment-counter on Postgres with strict idempotency + write a public blog post on the consistency trade-offs (8 weeks)." }
  ],
  "alternativePaths": [
    { "title": "Engineering Manager (Payments)", "rationale": "Strong mentorship signals; if IC trajectory plateaus, EM track preserves payment-domain leverage.", "pivotSteps": ["Volunteer to run 2027 perf-review cycle for the team", "Take 'EM fundamentals' course at Fellowship", "Run a 90-day on-call rota redesign"] }
  ],
  "quickWins": {
    "days30": [{ "action": "Author RFC for shared payment-error taxonomy", "effortHours": 8, "outcome": "RFC posted; +2 reviewers from adjacent teams" }],
    "days60": [{ "action": "Ship sharded counter prototype to staging", "effortHours": 24, "outcome": "Repo + benchmark numbers in design doc" }],
    "days90": [{ "action": "Publish 'idempotent payment retry' post on company blog", "effortHours": 12, "outcome": "Post live; 200+ internal views; staff-eng review citation" }]
  }
}
=== END STYLE EXAMPLE ===`;

export interface BuiltCareerPrompts {
  system: string;
  user: string;
}

export function buildCareerPathPrompts(body: CareerPathBodyT): BuiltCareerPrompts {
  const { inputs } = body;
  const { cvText, analysisSummary, currentRole, aspiration, language, industry } = inputs;

  const langInstr =
    language === 'vi'
      ? 'Respond in Vietnamese for all human-readable text fields; keep JSON keys English.'
      : language === 'auto'
        ? 'Respond in the CV language; keep JSON keys English.'
        : 'Respond in English.';

  const focusLabels = aspiration.focusAreas.length
    ? aspiration.focusAreas.map((k) => `- ${FOCUS_AREA_LABELS[k]}`).join('\n')
    : '- (none provided — infer the most natural focus from CV trajectory)';

  const milestoneCount =
    aspiration.horizonYears === 1 ? '3-4' : aspiration.horizonYears === 3 ? '4-5' : '5-6';

  const isNaturalMode =
    (!aspiration.targetRole || aspiration.targetRole === 'auto') &&
    aspiration.focusAreas.length === 0 &&
    !aspiration.industryShift &&
    !aspiration.constraints &&
    !aspiration.notes;

  const modeInstr = isNaturalMode
    ? 'NATURAL PROGRESSION MODE: The user has NOT specified a target — they want the most natural next-step roadmap based on their CV trajectory. Read the CV carefully, infer the strongest direction (continued specialization vs. leadership vs. adjacent pivot) given seniority + signature work, and build the roadmap toward that direction. Set feasibility.realistic=true (this is the realistic path by definition).'
    : 'TARGETED MODE: The user has stated an aspiration. Build the roadmap toward THAT goal. Judge feasibility honestly.';

  const industryAnchor =
    industry && industry.trim().length > 0
      ? `\n=== INDUSTRY ANCHOR ===\n${industry.trim()}\nmilestones / skillsToBuild / skillGaps PHẢI cụ thể cho industry này. Generic recommendations (e.g. "learn system design") KHÔNG acceptable — phải nêu khía cạnh industry-specific (e.g. fintech → idempotent payment retry + KYC audit trail design; e-commerce → cache invalidation + flash-sale traffic; healthtech → HIPAA / data residency; gov → procurement cycles).\n`
      : '';

  const system =
    'You are a senior career coach and former technical hiring manager. ' +
    'Always return ONE valid JSON object matching the requested schema. ' +
    'Be concrete, honest, concise. Never invent candidate experience. ' +
    'Tailor everything to the CV evidence + stated aspiration.\n\n' +
    FEW_SHOT_EXAMPLE;

  const user = `Build a personalised career-development roadmap.

=== CV ===
${cvText}

${analysisSummary ? `=== PRIOR ANALYSIS SUMMARY ===\n${analysisSummary}\n` : ''}${currentRole ? `=== CURRENT ROLE (detected) ===\n${currentRole}\n` : ''}
=== ASPIRATION ===
Target role: ${aspiration.targetRole || 'auto — infer from CV + focus areas'}
Horizon: ${aspiration.horizonYears} year(s)
Focus areas:
${focusLabels}
${aspiration.industryShift ? `Industry shift: ${aspiration.industryShift}` : ''}
${aspiration.constraints ? `Constraints: ${aspiration.constraints}` : ''}
${aspiration.notes ? `Notes: ${aspiration.notes}` : ''}
${industryAnchor}
=== INSTRUCTIONS ===
${modeInstr}

1. Read the CV carefully and extract real strengths + signature projects for currentSnapshot.
2. Judge feasibility FIRST. If the aspiration is achievable within the horizon given CV evidence, set feasibility.realistic=true with empty reasons + empty ambitionGap + empty requiredSteps. If the aspiration would need an unreasonable leap (e.g. junior → CTO of FAANG in 1 year, switching to a regulated field without any prerequisite, target requiring skills the candidate cannot plausibly build in time), set feasibility.realistic=false and:
   - reasons: 1-3 short, specific gaps (cite CV evidence, no jargon)
   - ambitionGap: 1 honest factual sentence stating the gap (no praise for ambition, no patronizing softener like "đáng quý", "đáng khen")
   - requiredSteps: 2-4 concrete bridging steps (course/role/artifact/timeline; not vague advice)
   - pragmaticAlternative: a concrete alternative title the candidate could realistically pursue.
   Whether realistic or not, STILL produce a useful roadmap below — when not realistic, the roadmap should target the pragmaticAlternative (or a scaled-down version of the aspiration), not the original ambitious goal. Never return an empty milestone list.
3. Set targetRole to the role the roadmap actually targets. If feasibility.realistic=false, this should be the pragmaticAlternative, not the original aspiration.
4. Produce ${milestoneCount} milestones spanning 0 → ${aspiration.horizonYears} years. yearOffset values must monotonically increase. Each milestone shows a realistic next role, what they'd own, what to learn, and what evidence to build. evidenceToShow MUST name the artifact + how it would read on a CV (e.g. "Rate-limiter library used by 3 teams" not "Build rate-limiter").
5. List 4-7 skillGaps the candidate needs to close. Be specific (no generic "communication"). Importance reflects how blocking the gap is for the target.

   SPECIFICITY RUBRIC — every skillGap.howToLearn MUST contain ALL 3 of:
   (1) course OR book OR mentor name
   (2) project OR repo OR shippable artifact
   (3) timeline (weeks / months)
   If any of the 3 is missing, redo that entry. Example: "Read DDIA chapters 6-8 + implement a sharded counter on Postgres + write a blog post on consistency trade-offs (8 weeks)."

6. alternativePaths MUST contain ≥1 entry. Even when feasibility.realistic=true and the primary aspiration is strong, surface ONE genuine alternative that demonstrates optionality (different industry pivot, adjacent specialization, EM-track if IC, etc.).
7. quickWins entries: each is an object {action, effortHours, outcome}. action is verb-led (≤80 chars), effortHours is realistic integer 1-40, outcome is a 1-line expected result.
8. If any meaningful caveat remains (assumptions, blind spots in CV), set "caveats" briefly. Do not overpromise.
9. ${langInstr}

Return JSON ONLY, matching this schema (no markdown, no commentary):
${SCHEMA}`;

  return { system, user };
}
