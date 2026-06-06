// Anon dedup — sessionStorage holds last N seen jobIds across refresh clicks
// within a tab. New tab = empty store (acceptable per design; anon users get
// best-effort dedup only). Signed-in dedup is server-side and persistent.
//
// Safe under private browsing / SSR: every access is try/catch wrapped, and
// any failure degrades to "no dedup" rather than throwing.

const KEY = 'jobfit:seen';
const MAX = 50;

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getSeenIds(): string[] {
  const store = safeStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function appendSeenIds(ids: string[]): void {
  if (ids.length === 0) return;
  const store = safeStorage();
  if (!store) return;
  try {
    const current = getSeenIds();
    const merged = [...current, ...ids];
    // Dedup preserving most-recent-wins by walking from the end.
    const seen = new Set<string>();
    const reversed: string[] = [];
    for (let i = merged.length - 1; i >= 0; i--) {
      const id = merged[i];
      if (id && !seen.has(id)) {
        seen.add(id);
        reversed.push(id);
      }
    }
    const final = reversed.reverse().slice(-MAX);
    store.setItem(KEY, JSON.stringify(final));
  } catch {
    // sessionStorage full / disabled — accept loss of dedup state, don't crash.
  }
}

export function clearSeenIds(): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // noop
  }
}

// Exposed for tests; kept at module scope above for readability.
export const SEEN_STORAGE_KEY = KEY;
export const SEEN_MAX = MAX;
