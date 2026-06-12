import { kv, kvAvailable } from '@/lib/quota/kv-client';

// Admin-controlled kill-switch for Luyện phỏng vấn (Interview Practice).
// When set to '0' (off):
//   - /interview, /interview/[id], /interview/[id]/results return 404
//   - /api/interview/start | submit | history | [id] | [id]/study-plan
//     return 503
//   - Sidebar nav drops the entry
//   - Job Fit detail "Luyện phỏng vấn" CTA hides
//
// Default ON: enabled unless explicitly set to '0' so shipping new code
// doesn't accidentally hide a live feature. kv.del → unset → reads as ON.
// Admin flipping off writes '0'. Mirrors job-fit-flag.ts.
export const INTERVIEW_FLAG = 'flag:interview-enabled';

const CACHE_TTL_MS = 5_000;
let cached: { value: boolean; expiresAt: number } | null = null;

export async function isInterviewEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (!kvAvailable) {
    // Fail-OPEN if KV is down — the route still gates on BYOK + ownership
    // so dark traffic can't actually do anything harmful. Better to keep
    // the feature visible than to dark-error every request.
    cached = { value: true, expiresAt: now + CACHE_TTL_MS };
    return true;
  }
  try {
    const raw = await kv.get<unknown>(INTERVIEW_FLAG);
    const off = raw === '0' || raw === 0;
    const on = !off;
    cached = { value: on, expiresAt: now + CACHE_TTL_MS };
    return on;
  } catch {
    cached = { value: true, expiresAt: now + CACHE_TTL_MS };
    return true;
  }
}

export function resetInterviewFlagCache(): void {
  cached = null;
}
