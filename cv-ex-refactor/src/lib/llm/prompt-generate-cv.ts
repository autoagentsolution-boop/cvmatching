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

Output ONLY Markdown. No preamble, no code fences.`;

  return { system, user };
}
