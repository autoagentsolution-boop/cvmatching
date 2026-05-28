import type { CareerPathBodyT } from '@/lib/schemas/llm-request';
import { FOCUS_AREA_LABELS } from '@/features/career-path/types';

const SCHEMA = `{
  "feasibility": {
    "realistic": "boolean — true if the aspiration is achievable from the CV within the horizon; false if it would require an unreasonable leap",
    "reasons": ["1-3 short, specific reasons referencing CV evidence — empty array when realistic"],
    "gentleAdvice": "1-2 warm, non-judgemental sentences explaining the constraint and pointing to a healthier framing (empty string when realistic)",
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
      "evidenceToShow": ["2-4 concrete portfolio/CV proof items"],
      "certifications": ["0-2 optional certs/courses"]
    }
  ],
  "skillGaps": [
    {
      "skill": "string — concrete skill name",
      "importance": "high|medium|low",
      "currentLevel": "none|basic|intermediate|advanced|expert",
      "targetLevel": "none|basic|intermediate|advanced|expert",
      "howToLearn": "1-2 sentence concrete path (course, project, mentor, etc.)"
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
    "days30": ["2-4 actions doable within 30 days"],
    "days60": ["2-4 actions for 30-60 days"],
    "days90": ["2-4 actions for 60-90 days"]
  },
  "caveats": "optional string — honest limits / assumptions"
}`;

export interface BuiltCareerPrompts {
  system: string;
  user: string;
}

export function buildCareerPathPrompts(body: CareerPathBodyT): BuiltCareerPrompts {
  const { inputs } = body;
  const { cvText, analysisSummary, currentRole, aspiration, language } = inputs;

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

  const system =
    'You are a senior career coach and former technical hiring manager. ' +
    'Always return ONE valid JSON object matching the requested schema. ' +
    'Be concrete, honest, concise. Never invent candidate experience. ' +
    'Tailor everything to the CV evidence + stated aspiration.';

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

=== INSTRUCTIONS ===
${modeInstr}

1. Read the CV carefully and extract real strengths + signature projects for currentSnapshot.
2. Judge feasibility FIRST. If the aspiration is achievable within the horizon given CV evidence, set feasibility.realistic=true with empty reasons + empty gentleAdvice. If the aspiration would need an unreasonable leap (e.g. junior → CTO of FAANG in 1 year, switching to a regulated field without any prerequisite, target requiring skills the candidate cannot plausibly build in time), set feasibility.realistic=false and:
   - reasons: 1-3 short, specific gaps (cite CV evidence, no jargon)
   - gentleAdvice: 1-2 warm, encouraging sentences. NEVER condescending. Acknowledge ambition, name the constraint, suggest a healthier framing.
   - pragmaticAlternative: a concrete alternative title the candidate could realistically pursue.
   Whether realistic or not, STILL produce a useful roadmap below — when not realistic, the roadmap should target the pragmaticAlternative (or a scaled-down version of the aspiration), not the original ambitious goal. Never return an empty milestone list.
3. Set targetRole to the role the roadmap actually targets. If feasibility.realistic=false, this should be the pragmaticAlternative, not the original aspiration.
4. Produce ${milestoneCount} milestones spanning 0 → ${aspiration.horizonYears} years. yearOffset values must monotonically increase. Each milestone shows a realistic next role, what they'd own, what to learn, and what evidence to build.
5. List 4-7 skillGaps the candidate needs to close. Be specific (no generic "communication"). Importance reflects how blocking the gap is for the target.
6. Suggest 1-2 alternativePaths only if genuinely viable from the CV.
7. quickWins must be doable today — concrete artifacts, repos, courses, networking moves.
8. If any meaningful caveat remains (assumptions, blind spots in CV), set "caveats" briefly. Do not overpromise.
9. ${langInstr}

Return JSON ONLY, matching this schema (no markdown, no commentary):
${SCHEMA}`;

  return { system, user };
}
