import { z } from 'zod';

/**
 * Server-only environment variables validated at startup.
 * NEVER import this file from client components or pages that run on the client.
 * All Auth fields remain optional so dev server starts without OAuth credentials.
 * Auth.js will throw a runtime error only when a sign-in is attempted without secrets set.
 */
const serverSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  DISABLE_SHARED_KEY: z.string().optional(),
  LOG_LLM_DEBUG: z.string().optional(),
  CSP_REPORT_ONLY: z.string().optional(),
  ADMIN_USER_IDS: z.string().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ALERT_SHARED_DAILY_CALLS: z.string().optional(),
  ALERT_SHARED_DAILY_COST_USD: z.string().optional(),
});

export const env = serverSchema.parse(process.env);
