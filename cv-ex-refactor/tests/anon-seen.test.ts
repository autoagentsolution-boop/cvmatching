import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendSeenIds,
  clearSeenIds,
  getSeenIds,
  SEEN_MAX,
  SEEN_STORAGE_KEY,
} from '@/lib/client/anon-seen';

class MemStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

beforeEach(() => {
  // Vitest node env has no window; polyfill enough for anon-seen.
  const win = { sessionStorage: new MemStorage() };
  // @ts-expect-error patch the global for the module under test
  globalThis.window = win;
});

afterEach(() => {
  // @ts-expect-error cleanup
  delete globalThis.window;
});

describe('anon-seen — sessionStorage helpers', () => {
  it('returns [] when nothing stored', () => {
    expect(getSeenIds()).toEqual([]);
  });

  it('appends + persists ids', () => {
    appendSeenIds(['a', 'b', 'c']);
    expect(getSeenIds()).toEqual(['a', 'b', 'c']);
  });

  it('dedupes preserving the latest occurrence', () => {
    appendSeenIds(['a', 'b']);
    appendSeenIds(['a', 'c']);
    // 'a' moves to the end since most-recent wins; reading order matches storage order.
    expect(getSeenIds()).toEqual(['b', 'a', 'c']);
  });

  it(`caps to ${SEEN_MAX}`, () => {
    const ids = Array.from({ length: 60 }, (_, i) => `id-${i}`);
    appendSeenIds(ids);
    const stored = getSeenIds();
    expect(stored.length).toBe(SEEN_MAX);
    // Latest 50 are kept — first 10 dropped.
    expect(stored[0]).toBe('id-10');
    expect(stored[stored.length - 1]).toBe('id-59');
  });

  it('clearSeenIds removes the key', () => {
    appendSeenIds(['a']);
    clearSeenIds();
    expect(getSeenIds()).toEqual([]);
    expect(window.sessionStorage.getItem(SEEN_STORAGE_KEY)).toBeNull();
  });

  it('no-ops on empty append', () => {
    appendSeenIds([]);
    expect(getSeenIds()).toEqual([]);
  });

  it('survives malformed stored JSON (defensive)', () => {
    window.sessionStorage.setItem(SEEN_STORAGE_KEY, 'not-json');
    expect(getSeenIds()).toEqual([]);
    appendSeenIds(['a']);
    expect(getSeenIds()).toEqual(['a']);
  });

  it('filters out non-string entries on read', () => {
    window.sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(['a', 5, null, 'b']));
    expect(getSeenIds()).toEqual(['a', 'b']);
  });
});

describe('anon-seen — SSR safety', () => {
  it('returns [] and no-ops when window is undefined', () => {
    // @ts-expect-error remove window for this case
    delete globalThis.window;
    expect(getSeenIds()).toEqual([]);
    appendSeenIds(['x']);
    clearSeenIds();
    // Reads after no-op writes still safe.
    expect(getSeenIds()).toEqual([]);
  });
});
