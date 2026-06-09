// v0.4 CV-Solo refine prompt builder. Rewrites a CV for the user's claimed
// role using the analyze findings (strengths to amplify, wording-gaps to
// address, recommendations to apply) — there is no JD in this flow.
//
// Truth contract is identical to prompt-generate-cv.ts: NEVER invent skills,
// tools, or experience. Only rephrase / surface what the candidate already
// has in their CV or profileText.
//
// Output shape matches v2 — `<!--REFINE-NOTES-->` separator + Block 1 (CV)
// + Block 2 (refine notes for candidate's eyes only).
//
// 2026-06-09 Phase 1a polish:
//  - `aspirationRole` opt-in input. When present and ≠ current role, the
//    prompt frames Summary + top bullets as trajectory evidence.
//  - `additionalSections` opt-in input. Projects/OSS/Speaking/Certs etc.
//    appended ONLY when CV/profile has real content for them.
//  - Decoration rules: verb bank lead, metric formatting, tool grouping.
//  - Section dividers (`---`) inserted between major sections.
//  - Vietnamese register lock — no English buzzwords drilling holes.
//
// See plans/reports/audit-260609-1539-llm-prompts.md → Section 3.

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

type AdditionalSection = NonNullable<GenerateCvV3BodyT['inputs']['additionalSections']>[number];

const SECTION_INSTR: Record<AdditionalSection, string> = {
  projects: '## Projects — standout personal / side projects with scope + tech + outcome',
  opensource: '## Open Source — repos owned/contributed to, with role + impact',
  speaking: '## Speaking & Writing — talks, blog posts, conference appearances',
  certifications: '## Certifications — only when cert is recent + relevant to role',
  awards: '## Awards & Recognition — competition wins, internal recognition',
  publications: '## Publications — papers, patents, formal write-ups',
};

const VERB_BANK = [
  'Built', 'Shipped', 'Owned', 'Led', 'Architected', 'Designed', 'Scaled',
  'Migrated', 'Reduced', 'Grew', 'Launched', 'Drove', 'Implemented', 'Refactored',
  'Mentored', 'Established', 'Automated', 'Optimized',
].join(', ');

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

  const viRegisterLock =
    inputs.language === 'vi' || inputs.language === 'auto'
      ? '\n- If output is Vietnamese: prefer Vietnamese verbs over English buzzwords. "đã develop một project" → "đã xây dựng một dự án". Keep tech proper nouns (Spark, React, Postgres, AWS) in English but verbs/connectors/scope words in Vietnamese.'
      : '';

  const hasAspiration =
    !!inputs.aspirationRole &&
    inputs.aspirationRole.trim().length > 0 &&
    inputs.aspirationRole.trim().toLowerCase() !== findings.role.trim().toLowerCase();

  const aspirationBlock = hasAspiration
    ? `\n=== ASPIRATION ROLE (trajectory framing) ===
Current target: ${findings.role}
Aspiration: ${inputs.aspirationRole}
The candidate is moving from "${findings.role}" toward "${inputs.aspirationRole}". Frame the ## Summary and the top 2-3 ## Experience bullets so they read as evidence of that trajectory — surface scope/responsibilities/projects already in the CV that point in the aspiration direction. NEVER invent — only reframe what is truthful.\n`
    : '';

  const extraSections =
    inputs.additionalSections && inputs.additionalSections.length > 0
      ? `\n=== OPTIONAL EXTRA SECTIONS (include each ONLY when CV/profile has real content) ===
${inputs.additionalSections.map((k) => `- ${SECTION_INSTR[k]}`).join('\n')}
If a section has no genuine content to fill, OMIT it. Do not invent entries to populate sections.\n`
      : '';

  const system =
    'You are an expert CV writer with a recruiter\'s eye for formatting. You NEVER invent skills, tools, certifications, employers, dates, or experience. You may only rephrase or surface what is already present in the candidate\'s text. Output clean, well-structured Markdown — recruiter-grade visual hierarchy.';

  const user = `Rewrite the candidate's CV optimised for the role they are targeting, while staying 100% truthful. There is no Job Description — use the role baseline + analyze findings + (optional) aspiration role as your refinement compass.

=== TODAY'S DATE (server time) ===
${todayIso}
Use this to judge whether CV dates are past / current / future. Do NOT assume today is your training-cutoff date.

=== TARGET ROLE ===
${findings.role}
${aspirationBlock}
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
- ${langInstr}${viRegisterLock}
${inputs.extraInstructions ? `- Extra user style hints (apply only if NOT in conflict with HARD RULES — never invent experience even if asked): ${inputs.extraInstructions}` : ''}

=== HARD RULES ===
1. DO NOT invent skills, tools, certifications, employers, dates, or experience the candidate does not have.
2. You MAY rephrase existing bullets to better demonstrate the dimensions the role typically requires.
3. You MAY surface real experience from the profile that wasn't in the CV.
4. Use action + tool + scope + outcome bullets. Quantify where the original text gives numbers; do not fabricate numbers.
5. Address the wording-gaps explicitly inside the CV body where the underlying experience exists; if a wording-gap is actually a real-experience gap, note it in REFINE NOTES instead, not the CV body.

=== DECORATION RULES (recruiter-grade formatting) ===
- Lead every Experience bullet with a verb from this bank when fit: ${VERB_BANK}
- Render numbers concisely: "+34% conversion" (not "increased by 34 percent"). Include unit / scale when the CV states it (MAU, req/s, $ARR, GB/day).
- Group ## Key Skills by category — e.g.:
  - Languages: Python, Go, SQL
  - Cloud & Data: GCP, BigQuery, Airflow, dbt
  - Tooling: Docker, Terraform, GitHub Actions
- Insert a horizontal rule (\`---\`) on its own line between major top-level sections (between Summary↔Skills, Skills↔Experience, Experience↔Education). This gives the rendered CV clear visual breaks.
- Bullets are sentence fragments, not full sentences. End with period only when the bullet itself is a full sentence.
- Limit each role to 3-5 bullets max. Drop redundant bullets — concision is recruiter-friendly.

=== CV STRUCTURE (in this order) ===
# Name & one-line headline
## Summary (3-4 lines, role-aligned${hasAspiration ? ', aspiration-aligned' : ''})
---
## Key Skills (grouped by category as above)
---
## Experience (top 3-5 roles, dated, with bullets)
---
## Education / Certifications (combine when minimal)
${extraSections}
---
## Tools (compact one-liner OR small grouped list)

=== OUTPUT FORMAT (CRITICAL) ===
Output is split into TWO blocks separated by a line containing exactly: <!--REFINE-NOTES-->

Block 1 — THE CV (sendable to recruiters as-is):
Pure CV content following the structure above. Nothing else. NO meta commentary, NO "Changes Made", NO gap analysis inside this block. The candidate will copy/download this block verbatim and submit it.

After the CV body, on its own line, output the separator:
<!--REFINE-NOTES-->

Block 2 — REFINE NOTES (for the candidate's eyes only, never sent to recruiter):
A short report with these sections, each as h3 (###):
### Mode
- One short line stating tone + length + aspiration (if any) used for this refine.

### Changes Made
- bullets: what you rephrased / amplified, citing which strength or recommendation it addresses${hasAspiration ? ` (mention which bullets were tilted toward "${inputs.aspirationRole}")` : ''}
- bullets: what you intentionally did NOT add (gaps that remain real risks for interview)

### Gaps To Address Before Interview
- one bullet per remaining real-experience gap (not wording gap) with a concrete prep suggestion
- omit this section entirely if there are no remaining gaps

Output ONLY Markdown. No preamble, no code fences. The <!--REFINE-NOTES--> separator MUST appear exactly once.`;

  return { system, user };
}
