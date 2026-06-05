import { z } from 'zod';

/**
 * Server-only environment variables validated at startup.
 * NEVER import this file from client components or pages that run on the client.
 * All Auth fields remain optional so dev server starts without OAuth credentials.
 * Auth.js will throw a runtime error only when a sign-in is attempted without secrets set.
 *
 * Note 2026-06-05: `vercel env pull` returns Sensitive-type vars as `""`
 * (per [[feedback_single_env_production_only]]). Without preprocessing,
 * `.optional()` keys fail format checks (.url(), .min(32)) on empty strings
 * → CLI scripts crash even though prod runtime has real values. The
 * `optStr` helper coerces `""` → `undefined` BEFORE the inner schema
 * validates, preserving optionality.
 */
function optStr<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), inner.optional());
}

const serverSchema = z.object({
  GEMINI_API_KEY: optStr(z.string()),
  OPENAI_API_KEY: optStr(z.string()),
  AUTH_SECRET: optStr(z.string().min(32)),
  AUTH_URL: optStr(z.string().url()),
  GOOGLE_CLIENT_ID: optStr(z.string()),
  GOOGLE_CLIENT_SECRET: optStr(z.string()),
  KV_REST_API_URL: optStr(z.string().url()),
  KV_REST_API_TOKEN: optStr(z.string()),
  DISABLE_SHARED_KEY: optStr(z.string()),
  LOG_LLM_DEBUG: optStr(z.string()),
  CSP_REPORT_ONLY: optStr(z.string()),
  ADMIN_USER_IDS: optStr(z.string()),
  ADMIN_USER_EMAILS: optStr(z.string()),
  ALERT_WEBHOOK_URL: optStr(z.string().url()),
  ALERT_SHARED_DAILY_CALLS: optStr(z.string()),
  ALERT_SHARED_DAILY_COST_USD: optStr(z.string()),
  // v0.3 Phase 2: HMAC key for KV embed cache keys. Required in prod; optional in dev.
  // Runtime call sites in Phase 2+ will fail closed (503) if absent.
  EMBED_CACHE_SECRET: optStr(z.string().min(32)),
  // v0.3 Phase 4: Bearer token for cron route. Vercel Pro auto-injects this.
  // Optional so local dev starts without it; refresh route rejects when absent in prod.
  CRON_SECRET: optStr(z.string().min(16)),
});

export const env = serverSchema.parse(process.env);
