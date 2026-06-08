import { z } from 'zod';

export const JdInsightsSchema = z.object({
  insightsParagraph: z.string().min(1).max(800),
  priorityChips: z.array(z.string().min(1).max(60)).max(5),
});

export type JdInsights = z.infer<typeof JdInsightsSchema>;

/**
 * Coerce arbitrary LLM JSON into the JdInsights shape — never throws.
 * Returns a safe default when parse fails so the UI can render a graceful empty.
 */
export function normalizeJdInsights(raw: unknown): JdInsights {
  if (!raw || typeof raw !== 'object') {
    return { insightsParagraph: '', priorityChips: [] };
  }

  const obj = raw as Record<string, unknown>;
  const insightsParagraph =
    typeof obj.insightsParagraph === 'string'
      ? obj.insightsParagraph.trim().slice(0, 800)
      : '';

  const rawChips = Array.isArray(obj.priorityChips) ? obj.priorityChips : [];
  const priorityChips = rawChips
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map((c) => c.trim().slice(0, 60))
    .slice(0, 3);

  return { insightsParagraph, priorityChips };
}
