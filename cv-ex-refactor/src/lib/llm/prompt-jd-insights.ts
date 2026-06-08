/**
 * JD Insights LLM prompt builder.
 *
 * Output contract (locked in design-intent.md decision #9):
 *   {
 *     insightsParagraph: string  (1-2 sentences synthesizing fit story)
 *     priorityChips: string[]    (1-3 short labels for the highest-priority gaps)
 *   }
 *
 * Tone: brutal recruiter — flag real risks, no participation-trophy language.
 * Cost target: ~$0.001/session at gemini-2.5-flash pricing.
 */

export interface JdInsightsPromptInputs {
  cvText: string;
  jdText: string;
  /** Optional analyze-v3 summary fed back so insights stay coherent with the score. */
  analyzeSummary?: string;
  language: 'en' | 'vi' | 'auto';
}

export interface BuiltJdInsightsPrompts {
  system: string;
  user: string;
}

export function buildJdInsightsPrompts(inputs: JdInsightsPromptInputs): BuiltJdInsightsPrompts {
  const { cvText, jdText, analyzeSummary, language } = inputs;

  const langInstr =
    language === 'vi'
      ? 'Trả lời bằng tiếng Việt nếu JD bằng tiếng Việt; nếu không, trả lời tiếng Anh.'
      : language === 'auto'
        ? 'Match the JD\'s primary language (Vietnamese or English).'
        : 'Always answer in English.';

  const system = [
    'You are a senior recruiter writing a frank fit summary for a hiring manager.',
    'Tone: direct, evidence-led, no flattery, no participation-trophy language.',
    'Output exactly ONE valid JSON object — no prose around it.',
  ].join(' ');

  const user = `Read the CV and JD below. ${analyzeSummary ? 'You also have a scoring summary from an earlier pass.' : ''}

Write a hiring-manager fit summary as JSON:
{
  "insightsParagraph": "<1-2 sentences. Lead with the strongest signal, then the most consequential risk. Cite evidence. No filler. ≤ 280 chars.>",
  "priorityChips": ["<short label>", "..."]
}

Rules for priorityChips:
- 1 to 3 chips, each ≤ 4 words.
- Title-case. Examples: "Quantify Impact", "Accessibility Gap", "Limited Scale".
- Pick the chips a recruiter would actually flag — concrete, not "Soft Skills".
- Skip if there are none meaningful (return empty array).

${langInstr}

${analyzeSummary ? `=== SCORING SUMMARY ===\n${analyzeSummary}\n` : ''}=== JD ===
${jdText}

=== CV ===
${cvText}`;

  return { system, user };
}
