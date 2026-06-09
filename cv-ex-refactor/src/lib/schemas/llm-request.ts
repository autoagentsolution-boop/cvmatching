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
export const CvModeEnum = z.enum(['apply', 'fill-gaps', 'stretch']);

export const LlmConfig = z
  .object({
    provider: ProviderEnum,
    model: z.string().min(1).max(120),
    temperature: z.number().min(0).max(2).default(0.3),
    baseUrl: z.string().url().max(2048).optional(),
    // BYOK key removed from body — clients pass it via the `x-llm-api-key`
    // request header instead, so it does not appear in the DevTools Payload
    // tab. Server reads the header in each route handler.
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

// v0.4 CV-Solo analyze contract. Coexists with v2 AnalyzeBody during transition
// (route discriminates by presence of inputs.jdText). Drops JD/targetRole/
// strictness/mustHaves/weights — none meaningful without a JD. Adds optional
// `role` so the client can submit a user-confirmed role after the role-infer
// modal (Phase 3 UI). When `role` is absent, the route runs the role-infer
// step itself.
export const AnalyzeV3Inputs = z.object({
  cvText: z.string().min(100).max(MAX_TEXT),
  profileText: z.string().max(10_000).optional(),
  language: LanguageEnum.default('auto'),
  role: z.string().min(2).max(120).optional(),
});

export const AnalyzeV3Body = z.object({
  llm: LlmConfig,
  inputs: AnalyzeV3Inputs,
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
    // Wave A: per-tier refine variant. Defaults to 'apply' (original behavior).
    mode: CvModeEnum.optional(),
  }),
  analysisSummary: z.string().min(10).max(4_000),
});

// v0.4 CV-solo generate-cv contract. Coexists with GenerateCvBody (v2) during
// the transition — /api/generate-cv discriminates by body shape (presence of
// inputs.jdText). v3 has no JD; refinement is driven by the analyze findings
// (strengths to amplify + wording-gaps to address + recommendations to apply).
export const AnalyzeFindings = z.object({
  role: z.string().min(2).max(160),
  strengths: z.array(z.string().max(400)).max(8).default([]),
  wordingGaps: z.array(z.string().max(400)).max(8).default([]),
  recommendations: z.array(z.string().max(400)).max(8).default([]),
  suggestedSummaryLine: z.string().max(400).optional(),
  /** Names of dimensions (coreSkill/tool/…) the CV scored weakly on — for prompt focus. */
  weakDimensions: z.array(z.string().max(40)).max(9).default([]),
});

export const GenerateCvV3Body = z.object({
  llm: LlmConfig,
  inputs: z.object({
    cvText: z.string().min(50).max(MAX_TEXT),
    profileText: z.string().max(10_000).optional(),
    language: LanguageEnum.default('auto'),
    tone: ToneEnum.default('impact'),
    length: LengthEnum.default('medium'),
    extraInstructions: z.string().max(500).optional(),
    /**
     * Future-target role the candidate is moving toward. When present and
     * different from findings.role (the current/detected target), the prompt
     * tilts Summary + top Experience bullets to read as trajectory evidence
     * from `role` → `aspirationRole`. Truth contract is unchanged — only
     * reframes real experience, never invents.
     */
    aspirationRole: z.string().min(1).max(160).optional(),
    /**
     * Opt-in extra sections. The prompt includes them only when CV/profile
     * has real content for the section — empty sections never appear.
     */
    additionalSections: z
      .array(z.enum(['projects', 'opensource', 'speaking', 'certifications', 'awards', 'publications']))
      .max(6)
      .optional(),
  }),
  findings: AnalyzeFindings,
});

export const ExtractMustHavesBody = z.object({
  llm: LlmConfig,
  jdText: z.string().min(50).max(MAX_TEXT),
  language: LanguageEnum.default('auto'),
});

export const JdInsightsBody = z.object({
  llm: LlmConfig,
  cvText: z.string().min(50).max(MAX_TEXT),
  jdText: z.string().min(50).max(MAX_TEXT),
  analyzeSummary: z.string().max(2000).optional(),
  language: LanguageEnum.default('auto'),
});
export type JdInsightsBodyT = z.infer<typeof JdInsightsBody>;

export const HorizonYearsEnum = z.union([z.literal(1), z.literal(3), z.literal(5)]);

export const FocusAreaEnum = z.enum([
  'leadership',
  'depth',
  'breadth',
  'switch_industry',
  'switch_function',
  'remote',
  'startup',
  'big_tech',
  'entrepreneurship',
  'consulting',
]);

export const CareerAspiration = z.object({
  targetRole: z.string().min(1).max(160),
  horizonYears: HorizonYearsEnum,
  focusAreas: z.array(FocusAreaEnum).max(6),
  industryShift: z.string().max(280).optional(),
  constraints: z.string().max(500).optional(),
  notes: z.string().max(1_000).optional(),
});

export const CareerPathBody = z.object({
  llm: LlmConfig,
  inputs: z.object({
    cvText: z.string().min(50).max(MAX_TEXT),
    analysisSummary: z.string().max(4_000).optional(),
    currentRole: z.string().max(160).optional(),
    aspiration: CareerAspiration,
    language: LanguageEnum.default('auto'),
  }),
});

export const SuggestPathsBody = z.object({
  llm: LlmConfig,
  inputs: z.object({
    cvText: z.string().min(50).max(MAX_TEXT),
    analysisSummary: z.string().max(4_000).optional(),
    currentRole: z.string().max(160).optional(),
    language: LanguageEnum.default('auto'),
  }),
});

export type AnalyzeBodyT = z.infer<typeof AnalyzeBody>;
export type AnalyzeV3BodyT = z.infer<typeof AnalyzeV3Body>;
export type AnalyzeV3InputsT = z.infer<typeof AnalyzeV3Inputs>;
export type GenerateCvV3BodyT = z.infer<typeof GenerateCvV3Body>;
export type AnalyzeFindingsT = z.infer<typeof AnalyzeFindings>;
export type GenerateCvBodyT = z.infer<typeof GenerateCvBody>;
export type ExtractMustHavesBodyT = z.infer<typeof ExtractMustHavesBody>;
export type CareerPathBodyT = z.infer<typeof CareerPathBody>;
export type SuggestPathsBodyT = z.infer<typeof SuggestPathsBody>;
export type LlmConfigT = z.infer<typeof LlmConfig>;
export type FocusAreaT = z.infer<typeof FocusAreaEnum>;
export type HorizonYearsT = z.infer<typeof HorizonYearsEnum>;
