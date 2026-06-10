import { kv, kvAvailable } from '@/lib/quota/kv-client';

// 2026-06-10: admin-controlled bypass for the DISABLE_SHARED_KEY env gate
// on /api/jobs/recommend specifically. Heavy endpoints (analyze,
// generate-cv) stay gated; Job Fit is cheap enough (one Gemini call per
// request, cost-bucket + per-user quota policed) that the operator can
// open it to non-admin users without unlocking shared key globally.
//
// Default = OFF so the gate stays closed unless an admin explicitly
// flips it ON via /admin/maintenance.
export const JOB_FIT_SHARED_KEY_FLAG = 'flag:job-fit-shared-key';

const CACHE_TTL_MS = 5_000;
let cached: { value: boolean; expiresAt: number } | null = null;

export async function isJobFitSharedKeyEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (!kvAvailable) {
    cached = { value: false, expiresAt: now + CACHE_TTL_MS };
    return false;
  }
  try {
    const raw = await kv.get<unknown>(JOB_FIT_SHARED_KEY_FLAG);
    const on = raw === '1' || raw === 1;
    cached = { value: on, expiresAt: now + CACHE_TTL_MS };
    return on;
  } catch {
    // Fail-CLOSED: KV outage shouldn't silently open shared key access.
    cached = { value: false, expiresAt: now + CACHE_TTL_MS };
    return false;
  }
}

export function resetJobFitSharedKeyCache(): void {
  cached = null;
}
