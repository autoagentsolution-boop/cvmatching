// v0.4 CV-Solo refine prompt builder. Rewrites a CV for the user's claimed
// role using the analyze findings (strengths to amplify, wording-gaps to
// address, recommendations to apply) — there is no JD in this flow.
//
// Truth contract is identical to prompt-generate-cv.ts: NEVER invent skills,
// tools, or experience. Only rephrase / surface what the candidate already
// has in their CV or profileText.
//
// Output shape matches v2 — `<!--REFINE-NOTES-->` separator + Block 1 (CV)
// + Block 2 (refine notes for candidate's eyes only). Lets results-section
// + RefinedCvView reuse existing splitCvAndNotes + render path with no UI
// changes beyond routing.
//
// See plans/260604-1356-v04-cv-solo-analyze-pivot/phase-* and follow-up
// notes in [[project_v04_pivot_cv_solo_analyze]] (CV-solo refined-cv path).

import type { GenerateCvV3BodyT } from '@/lib/schemas/llm-request';

const TONE_INSTR: Record<GenerateCvV3BodyT['inputs']['tone'], string> = {
  concise: 'Concise and professional. Short bullets, no fluff.',
  impact: 'Impact-led. Lead every bullet with measurable outcome / metric.',
  recruiter:
    'ATS-friendly. Use industry-standard keywords for the role where the underlying experience truthfully supports them. Scannable bullets.',
  executive:
    'Executive tone. Emphasize ownership, scope, leadership, business outcomes.',
};

const LENGTH_INSTR: Record<GenerateCvV3BodyT['inputs']['length'], string> = {
  short: 'Target 1 page.',
  medium: 'Target 1.5 pages.',
  long: 'Target 2 pages.',
};

export interface BuiltCvV3Prompts {
  system: string;
  user: string;
}

function bulletList(items: readonly string[], emptyLabel = '(none)'): string {
  if (items.length === 0) return emptyLabel;
  return items.map((s) => `- ${s}`).join('\n');
}

export function buildGenerateCvV3Prompts(body: GenerateCvV3BodyT): BuiltCvV3Prompts {
  const { inputs, findings } = body;
  const todayIso = new Date().toISOString().slice(0, 10);

  const langInstr =
    inputs.language === 'vi'
      ? 'Write the CV in Vietnamese.'
      : inputs.language === 'auto'
        ? 'Write the CV in the same language as the original CV.'
        : 'Write the CV in English.';

  const system =
    'You are an expert CV writer. You NEVER invent skills, tools, certifications, employers, dates, or experience. You may only rephrase or surface what is already present in the candidate\'s text. Output clean Markdown only.';

  const user = `Rewrite the candidate's CV optimised for the role they are targeting, while staying 100% truthful. There is no Job Description — use the role baseline + analyze findings below as your refinement compass.

=== TODAY'S DATE (server time) ===
${todayIso}
Use this to judge whether CV dates are past / current / future. Do NOT assume today is your training-cutoff date.

=== TARGET ROLE ===
${findings.role}

=== ORIGINAL CV ===
${inputs.cvText}

=== REAL EXPERIENCE PROFILE (true experience that may not be in the CV — you MAY surface this) ===
${inputs.profileText?.trim() || '(none provided)'}

=== ANALYZE FINDINGS (use these to drive the rewrite) ===
Strengths to amplify (lead with these; do not lose them):
${bulletList(findings.strengths)}

Wording gaps to fix (presentation issues — the experience is likely there, surface it clearly):
${bulletList(findings.wordingGaps)}

Recommendations to apply:
${bulletList(findings.recommendations)}

${findings.suggestedSummaryLine ? `Suggested summary line (use as the basis for the ## Summary section):\n${findings.suggestedSummaryLine}` : ''}

${findings.weakDimensions.length > 0 ? `Dimensions the CV scored weakly on (focus presentation effort here): ${findings.weakDimensions.join(', ')}` : ''}

=== STYLE ===
- Tone: ${TONE_INSTR[inputs.tone]}
- Length: ${LENGTH_INSTR[inputs.length]}
- ${langInstr}
${inputs.extraInstructions ? `- Extra instructions: ${inputs.extraInstructions}` : ''}

=== HARD RULES ===
1. DO NOT invent skills, tools, certifications, employers, dates, or experience the candidate does not have.
2. You MAY rephrase existing bullets to better demonstrate the dimensions the role typically requires.
3. You MAY surface real experience from the profile that wasn't in the CV.
4. Use action + tool + scope + outcome bullets. Quantify where the original text gives numbers; do not fabricate numbers.
5. Address the wording-gaps explicitly inside the CV body where the underlying experience exists; if a wording-gap is actually a real-experience gap (candidate lacks the capability), note it in REFINE NOTES instead, not the CV body.
6. CV STRUCTURE: # Name & headline, ## Summary (3-4 lines), ## Key Skills (grouped), ## Experience (top 3-5 roles with bullets), ## Education / Certifications (if present), ## Tools.

=== OUTPUT FORMAT (CRITICAL) ===
Output is split into TWO blocks separated by a line containing exactly: <!--REFINE-NOTES-->

Block 1 — THE CV (sendable to recruiters as-is):
Pure CV content following the structure above. Nothing else. NO meta commentary, NO "Changes Made", NO gap analysis inside this block. The candidate will copy/download this block verbatim and submit it.

After the CV body, on its own line, output the separator:
<!--REFINE-NOTES-->

Block 2 — REFINE NOTES (for the candidate's eyes only, never sent to recruiter):
A short report with these sections, each as h3 (###):
### Changes Made
- bullets: what you rephrased / amplified, citing which strength or recommendation it addresses
- bullets: what you intentionally did NOT add (gaps that remain real risks for interview)

### Gaps To Address Before Interview
- one bullet per remaining real-experience gap (not wording gap) with a concrete prep suggestion
- omit this section entirely if there are no remaining gaps

Output ONLY Markdown. No preamble, no code fences. The <!--REFINE-NOTES--> separator MUST appear exactly once.`;

  return { system, user };
}
