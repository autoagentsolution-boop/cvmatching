// Single source of truth for per-user client-side caches.
//
// Why: NextAuth signout is a Server Action that redirects — no client hook
// fires to clear localStorage/sessionStorage. When user A signs out and
// user B signs in on the same browser, B inherits A's CV text, JD, analyze
// results, job-fit matches, and roadmap. Privacy + UX bug.
//
// Strategy: enumerate every per-user key once here, expose a single purge
// function called from a session-id watcher hook. Adding a new persisted
// key elsewhere → add to the array below; one place to keep in sync.

const PERSISTED_LOCAL_STORAGE_KEYS = [
  // settings-store — provider/model/temperature/baseUrl (per-user config)
  'cv-ex-settings-v1',
  // career-path-store — saved roadmap + suggestions
  'cv-ex-career-path-v1',
  // analyze banner dismissal flag
  'cv-ex-analysis-banner-dismissed',
] as const;

const PERSISTED_SESSION_STORAGE_KEYS = [
  // current analyze store (v0.4 CV-solo + JD-match results)
  'cv-ex-analysis-v4',
  // legacy analyze keys — purge in case a stale tab still has them
  'cv-ex-analysis-v1',
  'cv-ex-analysis-v2',
  'cv-ex-analysis-v3',
  // job-fit recommendations
  'job-fit-matches:v2',
  // CV text shared across refined-cv / job-fit / career-path
  'refined-cv-text:v1',
] as const;

/** Track the last signed-in user id so we can detect identity changes. */
export const LAST_USER_ID_KEY = 'cv-ex-last-user-id' as const;

/**
 * Wipe every per-user cache. Safe to call multiple times; missing keys
 * are no-ops. Catches per-key so a single bad backend doesn't abort the
 * rest (relevant when storage quota is exceeded).
 */
export function clearAllUserCaches(): void {
  if (typeof window === 'undefined') return;

  for (const k of PERSISTED_LOCAL_STORAGE_KEYS) {
    try { window.localStorage.removeItem(k); } catch { /* swallow */ }
  }
  for (const k of PERSISTED_SESSION_STORAGE_KEYS) {
    try { window.sessionStorage.removeItem(k); } catch { /* swallow */ }
  }
}
