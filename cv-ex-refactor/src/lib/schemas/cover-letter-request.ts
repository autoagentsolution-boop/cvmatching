import { z } from 'zod';
import { LlmConfig } from './llm-request';

// Body for POST /api/generate-cover-letter — Wave A Phase 4.
// Caps tightened vs. generate-cv: cover letters are short, JD context only needs
// the head/main paragraphs of the description.
// Phase 1d: tone + length presets + analysis findings feed + bilingual.
export const CoverLetterToneEnum = z.enum(['warm', 'professional', 'concise', 'leadership']);
export const CoverLetterLengthEnum = z.enum(['short', 'medium', 'long']);

export const CoverLetterBody = z.object({
  llm: LlmConfig,
  inputs: z.object({
    cvText: z.string().min(50).max(20_000),
    jdText: z.string().min(50).max(10_000),
    jobTitle: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    language: z.enum(['en', 'vi', 'auto']).default('auto'),
    /** Phase 1d — tone preset. Defaults to professional. */
    tone: CoverLetterToneEnum.default('professional'),
    /** Phase 1d — length band: short=150-200, medium=250-400, long=400-550 words. */
    length: CoverLetterLengthEnum.default('medium'),
    /**
     * Phase 1d — top 1-3 strength titles from analyze. When present the
     * letter's evidence paragraph leads with these. Derived client-side
     * from analyzeResult.strengths.
     */
    strengthsToLead: z.array(z.string().min(1).max(200)).max(3).optional(),
    /**
     * Phase 1d — top 1 gap user opts in to address head-on (1 sentence
     * near the close, no apology). Derived from analyzeResult.gaps when
     * the "address gap" checkbox is on.
     */
    gapToAddress: z.string().min(1).max(300).optional(),
  }),
});

export type CoverLetterBodyT = z.infer<typeof CoverLetterBody>;
export type CoverLetterToneT = z.infer<typeof CoverLetterToneEnum>;
export type CoverLetterLengthT = z.infer<typeof CoverLetterLengthEnum>;
