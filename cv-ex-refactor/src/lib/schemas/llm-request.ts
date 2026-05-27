import { z } from 'zod';

export const ProviderEnum = z.enum(['gemini', 'openai', 'custom']);
export const StrictnessEnum = z.enum(['balanced', 'strict', 'friendly']);
export const LanguageEnum = z.enum(['en', 'vi', 'auto']);
export const RoleFamilyEnum = z.enum([
  'auto',
  'data_engineer',
  'data_platform',
  'manager',
  'pm_delivery',
  'solution',
  'software',
  'other',
]);
export const ToneEnum = z.enum(['concise', 'impact', 'recruiter', 'executive']);
export const LengthEnum = z.enum(['short', 'medium', 'long']);

export const LlmConfig = z
  .object({
    provider: ProviderEnum,
    model: z.string().min(1).max(120),
    temperature: z.number().min(0).max(2).default(0.3),
    baseUrl: z.string().url().max(2048).optional(),
    apiKey: z.string().min(1).max(512).optional(),
  })
  .refine(
    (v) => v.provider !== 'custom' || !!v.baseUrl,
    { message: 'Custom provider requires baseUrl', path: ['baseUrl'] },
  );

export const Weights = z.object({
  coreSkill: z.number().min(0).max(100),
  tool: z.number().min(0).max(100),
  scope: z.number().min(0).max(100),
  production: z.number().min(0).max(100),
  domain: z.number().min(0).max(100),
  evidence: z.number().min(0).max(100),
  seniority: z.number().min(0).max(100),
  impact: z.number().min(0).max(100),
  communication: z.number().min(0).max(100),
});

const MAX_TEXT = 50_000;

export const AnalyzeInputs = z.object({
  jdText: z.string().min(50).max(MAX_TEXT),
  jdUrl: z.string().url().max(2048).optional(),
  cvText: z.string().min(50).max(MAX_TEXT),
  profileText: z.string().max(10_000).optional(),
  targetRole: RoleFamilyEnum,
  strictness: StrictnessEnum,
  language: LanguageEnum,
  // Accepted for backward compat but ignored — per-dim scores are LLM output, not input.
  weights: Weights.optional(),
  mustHaves: z.array(z.string().max(280)).max(20),
});

export const AnalyzeBody = z.object({
  llm: LlmConfig,
  inputs: AnalyzeInputs,
});

export const GenerateCvBody = z.object({
  llm: LlmConfig,
  inputs: z.object({
    jdText: z.string().min(50).max(MAX_TEXT),
    cvText: z.string().min(50).max(MAX_TEXT),
    profileText: z.string().max(10_000).optional(),
    language: LanguageEnum,
    tone: ToneEnum,
    length: LengthEnum,
    extraInstructions: z.string().max(500).optional(),
  }),
  analysisSummary: z.string().min(10).max(4_000),
});

export const ExtractMustHavesBody = z.object({
  llm: LlmConfig,
  jdText: z.string().min(50).max(MAX_TEXT),
  language: LanguageEnum.default('auto'),
});

export type AnalyzeBodyT = z.infer<typeof AnalyzeBody>;
export type GenerateCvBodyT = z.infer<typeof GenerateCvBody>;
export type ExtractMustHavesBodyT = z.infer<typeof ExtractMustHavesBody>;
export type LlmConfigT = z.infer<typeof LlmConfig>;
