import { z } from 'zod';

export const LLMConfigSchema = z.object({
  provider: z.enum(['gemini', 'openai']).default('gemini'),
  model: z.string().default('gemini-2.5-flash'),
  temperature: z.number().min(0).max(1).default(0.3),
}).default({ provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.3 });

export const RecommendBodySchema = z.object({
  cvText: z.string().min(200).max(20000),
  llm: LLMConfigSchema.optional(),
});

export type RecommendBody = z.infer<typeof RecommendBodySchema>;
export type RecommendLlmConfig = z.infer<typeof LLMConfigSchema>;
