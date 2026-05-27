import { kv } from '@vercel/kv';
import { env } from '@/lib/env';

/**
 * True only when KV env vars are present. `@vercel/kv` reads env at call time and
 * throws if missing, so callers should branch on this flag and fail-open in dev.
 */
export const kvAvailable: boolean = Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);

export { kv };
