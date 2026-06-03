import type { GenerateCvBodyT } from '@/lib/schemas/llm-request';

const TONE_INSTR: Record<GenerateCvBodyT['inputs']['tone'], string> = {
  concise: 'Concise and professional. Short bullets, no fluff.',
  impact: 'Impact-led. Lead every bullet with measurable outcome / metric.',
  recruiter: 'ATS-friendly. Mirror JD keywords where truthful. Use scannable bullets.',
  executive: 'Executive tone. Emphasize ownership, scope, leadership, business outcomes.',
};

const LENGTH_INSTR: Record<GenerateCvBodyT['inputs']['length'], string> = {
  short: 'Target 1 page.',
  medium: 'Target 1.5 pages.',
  long: 'Target 2 pages.',
};

type CvMode = NonNullable<GenerateCvBodyT['inputs']['mode']>;

// Mode addenda — injected as a dedicated block in the user prompt so the LLM
// reads it last and can see how it interacts with the HARD RULES above.
const MODE_INSTR: Record<CvMode, string> = {
  apply:
    'MODE: APPLY — Candidate is a strong fit. Polish for impact: lead with the most JD-aligned wins, sharpen verbs and metrics, tighten any vague bullets. Surface every real proof point that matches a JD requirement.',
  'fill-gaps':
    'MODE: FILL GAPS — Candidate has the core fit but a few JD requirements lack visible evidence in the CV. Surface real experience that addresses each gap (rephrase, expand, pull from profile). DO NOT fabricate. If a gap is genuinely not in the candidate\'s background, add a "## Gaps To Address Before Interview" section listing each remaining gap with a concrete prep suggestion — do NOT pretend the gap is closed.',
  stretch:
    'MODE: STRETCH — Candidate is below the role bar; this is a reach application. Highlight transferable skills and learning trajectory. Frame past work as evidence of capability to grow into the role. Be honest about the gap in the "## Changes Made" section: mention what is NOT yet at the level the JD requires and what the candidate would need to demonstrate in interview to close it. Tone should be confident but never inflate seniority.',
};

export interface BuiltCvPrompts {
  system: string;
  user: string;
}

export function buildGenerateCvPrompts(body: GenerateCvBodyT): BuiltCvPrompts {
  const { inputs, analysisSummary } = body;
  const langInstr =
    inputs.language === 'vi'
      ? 'Write the CV in Vietnamese.'
      : inputs.language === 'auto'
        ? 'Write the CV in the same language as the JD.'
        : 'Write the CV in English.';

  const system =
    'You are an expert CV writer. You NEVER invent skills, tools, or experience. You may only rephrase or surface what is already in the candidate\'s text. Output clean Markdown only.';

  const mode: CvMode = inputs.mode ?? 'apply';
  const user = `Rewrite the candidate's CV to better match the Job Description, while staying 100% truthful.

=== JOB DESCRIPTION ===
${inputs.jdText}

=== ORIGINAL CV ===
${inputs.cvText}

=== REAL EXPERIENCE PROFILE (true experience that may not be in the CV — you MAY surface this) ===
${inputs.profileText?.trim() || '(none provided)'}

=== PRIOR ANALYSIS CONTEXT ===
${analysisSummary}

=== STYLE ===
- Tone: ${TONE_INSTR[inputs.tone]}
- Length: ${LENGTH_INSTR[inputs.length]}
- ${langInstr}
${inputs.extraInstructions ? `- Extra instructions: ${inputs.extraInstructions}` : ''}

=== HARD RULES ===
1. DO NOT invent skills, tools, certifications, employers, or experience the candidate does not have.
2. You MAY rephrase existing bullets using JD keywords IF the underlying experience is true.
3. You MAY surface real experience from the profile that wasn't in the CV.
4. Use action + tool + scope + outcome bullets. Quantify where the original text gives numbers.
5. Structure: # Name & headline, ## Summary (3-4 lines), ## Key Skills (grouped), ## Experience (top 3-5 roles with bullets), ## Education / Certifications (if present), ## Tools.
6. End with "## Changes Made" — list:
   - what you emphasized or rephrased to match the JD (cite the JD signal)
   - what you intentionally did NOT add (gaps that remain real risks for interview)

=== MODE ===
${MODE_INSTR[mode]}

Output ONLY Markdown. No preamble, no code fences.`;

  return { system, user };
}
