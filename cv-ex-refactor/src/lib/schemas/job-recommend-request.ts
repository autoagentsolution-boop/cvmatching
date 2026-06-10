import { z } from 'zod';

export const LLMConfigSchema = z.object({
  provider: z.enum(['gemini', 'openai']).default('gemini'),
  model: z.string().default('gemini-flash-latest'),
  temperature: z.number().min(0).max(1).default(0.3),
}).default({ provider: 'gemini', model: 'gemini-flash-latest', temperature: 0.3 });

export const RecommendBodySchema = z.object({
  cvText: z.string().min(200).max(20000),
  llm: LLMConfigSchema.optional(),
  // Anon-user client-side dedup. Capped at 50 ids × 32 chars = 1.6KB max.
  // Only consulted when no session is attached (signed-in dedup is
  // server-side via user_seen_job table). Phase 4 of jobfit-db-pool-monetize.
  seenIds: z.array(z.string().max(32)).max(50).optional(),
});

export type RecommendBody = z.infer<typeof RecommendBodySchema>;
export type RecommendLlmConfig = z.infer<typeof LLMConfigSchema>;
