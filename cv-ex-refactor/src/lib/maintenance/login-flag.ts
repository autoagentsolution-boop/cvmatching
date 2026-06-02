import { kv, kvAvailable } from '@/lib/quota/kv-client';

export const LOGIN_FLAG_KEY = 'login:enabled';

const CACHE_TTL_MS = 5_000;
let cached: { value: boolean; expiresAt: number } | null = null;

/**
 * Returns true when public login is enabled. While disabled, the /sign-in
 * page 404s and the topnav login button is hidden — guests have no UI path
 * to start OAuth. Admin sessions always pass through regardless of the flag.
 *
 * Fail-CLOSED: any KV error or missing config returns false (login disabled)
 * so a misconfigured deploy never silently exposes the login flow.
 */
export async function isLoginEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (!kvAvailable) {
    cached = { value: false, expiresAt: now + CACHE_TTL_MS };
    return false;
  }
  try {
    const raw = await kv.get<unknown>(LOGIN_FLAG_KEY);
    const on = raw === '1' || raw === 1;
    cached = { value: on, expiresAt: now + CACHE_TTL_MS };
    return on;
  } catch {
    cached = { value: false, expiresAt: now + CACHE_TTL_MS };
    return false;
  }
}

export function resetLoginFlagCache(): void {
  cached = null;
}
