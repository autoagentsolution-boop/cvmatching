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
  // v0.4 Phase A — Neon Postgres + pgvector for jobs/users/seen/subs (jobfit
  // DB+monetize plan). DATABASE_URL = pgbouncer-pooled for runtime queries;
  // DATABASE_URL_UNPOOLED = direct connection for Drizzle migrations (pooled
  // mode does not support DDL across connections). Both auto-injected by
  // Vercel Marketplace Neon integration; optional locally because dev/test
  // suites that don't touch the DB layer must still boot.
  DATABASE_URL: optStr(z.string().url()),
  DATABASE_URL_UNPOOLED: optStr(z.string().url()),
  // Phase 4 cutover flag for the Job Fit recommend route.
  // - undefined / '0' / 'false' → LEGACY KV path + admin-only lockdown (current prod behaviour)
  // - '1' / 'true'              → NEW Postgres path + tier-gated public (anon/free/paid)
  // Flip to '1' AFTER `pnpm db:migrate-from-kv` runs OR after Phase 5 scrapers
  // populate the Postgres `jobs` table. Otherwise the route will fail with
  // 503 "Job index empty" because pgvector has no rows to rank.
  JOBFIT_USE_POSTGRES: optStr(z.string()),
  // Phase 6 — SePay VietQR monetization. All optional locally; required in
  // production. Webhook + checkout routes fail-closed (503) when absent.
  // MONETIZATION_ENABLED is the kill switch — DEFAULT OFF until pricing
  // ships. Set '1' or 'true' to enable; any other value (incl. unset, '0',
  // 'false') keeps /upgrade unreachable, webhook 503, nav link hidden, and
  // resolveUserTier promotes every signed-in user to 'paid' so they're not
  // stranded at the 2-job free cap with no way to upgrade.
  SEPAY_WEBHOOK_API_KEY: optStr(z.string().min(16)),
  SEPAY_ACCOUNT_NUMBER: optStr(z.string()),
  SEPAY_ACCOUNT_NAME: optStr(z.string()),
  SEPAY_BANK_NAME: optStr(z.string()),
  PAID_PLAN_PRICE_VND: optStr(z.string().regex(/^\d+$/)),
  MONETIZATION_ENABLED: optStr(z.string()),

  // Fine-grained GitHub PAT used by /api/admin/pool/trigger to dispatch
  // refresh-jobs.yml. Scope: Actions read+write on this repo only.
  // Sensitive — never logged, never echoed to clients. Optional: if unset,
  // trigger endpoint returns 503 with actionable message.
  GITHUB_DISPATCH_TOKEN: optStr(z.string().min(20)),
  // Public repo coordinates for the dispatch URL. Default matches the live
  // remote so deploys don't break when GITHUB_REPO is unset; override only
  // for forks/staging.
  GITHUB_REPO: optStr(z.string().regex(/^[^/]+\/[^/]+$/)),
});

/**
 * Vars that MUST be set in production. If absent at module-load time on a
 * prod deploy, parse() throws — fails closed at cold start instead of
 * silently using the dev-fallback strings literal-coded in auth.ts /
 * encrypt-key.ts. Without this guard a misconfigured Vercel env would
 * derive the BYOK AES key from a public string, making every encrypted
 * BYOK blob in KV trivially decryptable by anyone with the source.
 *
 * Locally (`NODE_ENV !== 'production'`) all vars stay optional so
 * `pnpm dev` boots without OAuth/KV/etc configured.
 */
const PROD_REQUIRED = [
  'AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'EMBED_CACHE_SECRET',
  'CRON_SECRET',
] as const satisfies readonly (keyof z.infer<typeof serverSchema>)[];

const refined = serverSchema.superRefine((v, ctx) => {
  if (process.env.NODE_ENV !== 'production') return;
  // Next.js `next build` runs the route-metadata collection step with
  // NODE_ENV=production but without runtime env injected. Skip the
  // fail-closed check during build — Vercel injects env at function
  // invocation time. NEXT_PHASE values come from next/constants.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  for (const key of PROD_REQUIRED) {
    if (!v[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production — Vercel env injection missing or returned ''.`,
      });
    }
  }
  // At least one shared-key provider OR explicit shared-key kill-switch.
  const hasGemini = !!v.GEMINI_API_KEY;
  const hasOpenAI = !!v.OPENAI_API_KEY;
  const sharedKeyOff = v.DISABLE_SHARED_KEY === '1' || v.DISABLE_SHARED_KEY === 'true';
  if (!sharedKeyOff && !hasGemini && !hasOpenAI) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GEMINI_API_KEY'],
      message: 'In production, either set GEMINI_API_KEY/OPENAI_API_KEY OR set DISABLE_SHARED_KEY=1 to force BYOK-only.',
    });
  }
});

export const env = refined.parse(process.env);
