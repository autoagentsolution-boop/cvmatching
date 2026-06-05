// v0.4 cache-migration helpers for the analyze store.
//
// On the pivot we bump the persisted store key from cv-ex-analysis-v1 (v2
// JD-comparison schema) → cv-ex-analysis-v2 (v3 CV-solo schema). Zustand
// keys each version separately, so the new store starts empty even when a
// legacy entry exists. Detection here lets the re-analyze banner surface
// the legacy data so users can rerun with the new prompt at their own
// pace — never auto-fire, never burn quota silently.
//
// See plans/260604-1356-v04-cv-solo-analyze-pivot/phase-06-cache-version-bump.md

export const CURRENT_STORAGE_KEY = 'cv-ex-analysis-v4' as const;

/** Older keys, oldest first. Each gets cleaned on dismissal. */
export const LEGACY_STORAGE_KEYS = ['cv-ex-analysis-v1', 'cv-ex-analysis-v2', 'cv-ex-analysis-v3'] as const;

const DISMISS_FLAG_KEY = 'cv-ex-analysis-banner-dismissed';

export interface LegacyCachePresence {
  found: boolean;
  oldKey: string | null;
  cvText: string | null;
}

function readSessionRaw(key: string): string | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Look in sessionStorage for any of the legacy keys. Returns the first hit
 * plus the cvText we can salvage (so the banner can pre-fill the new store
 * before redirecting the user to re-analyze).
 *
 * Zustand's persist middleware wraps state under { state, version } — the
 * cvText lives at parsed.state.cvText. We're defensive: malformed JSON,
 * missing state, or absent cvText all degrade to "found but cvText=null"
 * so the banner can still offer dismissal without crashing.
 */
export function detectLegacyCache(): LegacyCachePresence {
  for (const key of LEGACY_STORAGE_KEYS) {
    const raw = readSessionRaw(key);
    if (!raw) continue;

    let cvText: string | null = null;
    try {
      const parsed = JSON.parse(raw);
      const candidate = parsed?.state?.cvText ?? parsed?.cvText;
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        cvText = candidate;
      }
    } catch {
      // corrupt JSON — treat as legacy presence with no salvageable cvText
    }
    return { found: true, oldKey: key, cvText };
  }
  return { found: false, oldKey: null, cvText: null };
}

/** Remove all legacy keys (called after user accepts or dismisses the banner). */
export function clearLegacyCache(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // best-effort
    }
  }
}

/**
 * Persistent dismissal flag in localStorage (NOT sessionStorage — so the
 * dismissal sticks across browser sessions and tabs without re-pestering
 * the user). Setting the flag also clears any remaining legacy entries.
 */
export function markBannerDismissed(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(DISMISS_FLAG_KEY, '1');
  } catch {
    // best-effort
  }
  clearLegacyCache();
}

export function isBannerDismissed(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(DISMISS_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}
