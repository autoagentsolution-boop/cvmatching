import { kv, kvAvailable } from '@/lib/quota/kv-client';

// 2026-06-10: admin-controlled kill-switch for Job Fit. When set to '0'
// (off), the entire Job Fit surface goes dark — recommend endpoint
// returns 503, workflow chevrons drop the step, /job-fit page renders
// a maintenance state. Used by admins during pilot to hide the feature
// if the pool is broken / Gemini is throttled / cost-bucket is hot.
//
// Default ON: the flag is "enabled" unless explicitly set to '0' so
// shipping the code doesn't accidentally hide an already-live feature.
// kv.del → unset → reads as ON. Admin flipping off writes '0'.
export const JOB_FIT_FLAG = 'flag:job-fit-enabled';

const CACHE_TTL_MS = 5_000;
let cached: { value: boolean; expiresAt: number } | null = null;

export async function isJobFitEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (!kvAvailable) {
    // Fail-OPEN here (unlike DISABLE_SHARED_KEY) — if KV is down the
    // feature stays visible. The recommend endpoint has its own gates
    // (resolveApiKey + kill-switch) that won't let traffic through if
    // shared key / pool / Postgres also broke.
    cached = { value: true, expiresAt: now + CACHE_TTL_MS };
    return true;
  }
  try {
    const raw = await kv.get<unknown>(JOB_FIT_FLAG);
    // ON when key absent OR set to anything other than the explicit '0' kill.
    const off = raw === '0' || raw === 0;
    const on = !off;
    cached = { value: on, expiresAt: now + CACHE_TTL_MS };
    return on;
  } catch {
    cached = { value: true, expiresAt: now + CACHE_TTL_MS };
    return true;
  }
}

export function resetJobFitFlagCache(): void {
  cached = null;
}
