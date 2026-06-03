import { z } from 'zod';
import { LlmConfig } from './llm-request';

// Body for POST /api/generate-cover-letter — Wave A Phase 4.
// Caps tightened vs. generate-cv: cover letters are short, JD context only needs
// the head/main paragraphs of the description.
export const CoverLetterBody = z.object({
  llm: LlmConfig,
  inputs: z.object({
    cvText: z.string().min(50).max(20_000),
    jdText: z.string().min(50).max(10_000),
    jobTitle: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    language: z.enum(['en', 'vi', 'auto']).default('auto'),
  }),
});

export type CoverLetterBodyT = z.infer<typeof CoverLetterBody>;
