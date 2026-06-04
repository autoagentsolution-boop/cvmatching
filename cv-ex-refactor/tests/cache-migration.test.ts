// Unit tests for v0.4 cache-migration helpers. Stub sessionStorage +
// localStorage manually since vitest is node-env (no jsdom). Verifies the
// detection contract, the cvText salvage path, and dismissal persistence.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectLegacyCache,
  clearLegacyCache,
  markBannerDismissed,
  isBannerDismissed,
  CURRENT_STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
} from '@/features/analyze/cache-migration';

class MockStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

type WindowSlot = { window?: unknown };

beforeEach(() => {
  const session = new MockStorage();
  const local = new MockStorage();
  // Minimal window stub — only what cache-migration touches. Avoid declaring
  // the global window type; cast via unknown each time so we don't conflict
  // with lib.dom's Window definition.
  (globalThis as unknown as WindowSlot).window = { sessionStorage: session, localStorage: local };
});

afterEach(() => {
  delete (globalThis as unknown as WindowSlot).window;
});

describe('CURRENT_STORAGE_KEY + LEGACY_STORAGE_KEYS', () => {
  it('exposes v2 as current and v1 as legacy (no overlap)', () => {
    expect(CURRENT_STORAGE_KEY).toBe('cv-ex-analysis-v2');
    expect(LEGACY_STORAGE_KEYS).toContain('cv-ex-analysis-v1');
    expect(LEGACY_STORAGE_KEYS).not.toContain(CURRENT_STORAGE_KEY);
  });
});

describe('detectLegacyCache', () => {
  it('returns { found: false } when nothing in sessionStorage', () => {
    expect(detectLegacyCache()).toEqual({ found: false, oldKey: null, cvText: null });
  });

  it('finds legacy v1 key + salvages cvText from zustand-persist shape', () => {
    const persisted = JSON.stringify({
      state: { cvText: 'My CV body here', jdText: 'old jd' },
      version: 0,
    });
    ((globalThis as unknown as WindowSlot).window as { sessionStorage: MockStorage }).sessionStorage
      .setItem('cv-ex-analysis-v1', persisted);

    const result = detectLegacyCache();
    expect(result.found).toBe(true);
    expect(result.oldKey).toBe('cv-ex-analysis-v1');
    expect(result.cvText).toBe('My CV body here');
  });

  it('returns found:true cvText:null when JSON is corrupt', () => {
    ((globalThis as unknown as WindowSlot).window as { sessionStorage: MockStorage }).sessionStorage
      .setItem('cv-ex-analysis-v1', '{not json');
    const r = detectLegacyCache();
    expect(r.found).toBe(true);
    expect(r.cvText).toBeNull();
  });

  it('returns found:true cvText:null when cvText empty/whitespace', () => {
    ((globalThis as unknown as WindowSlot).window as { sessionStorage: MockStorage }).sessionStorage
      .setItem('cv-ex-analysis-v1', JSON.stringify({ state: { cvText: '   ' } }));
    expect(detectLegacyCache().cvText).toBeNull();
  });

  it('does NOT report current key as legacy', () => {
    ((globalThis as unknown as WindowSlot).window as { sessionStorage: MockStorage }).sessionStorage
      .setItem(CURRENT_STORAGE_KEY, JSON.stringify({ state: { cvText: 'x' } }));
    expect(detectLegacyCache().found).toBe(false);
  });

  it('falls back to top-level cvText when state wrapper absent', () => {
    ((globalThis as unknown as WindowSlot).window as { sessionStorage: MockStorage }).sessionStorage
      .setItem('cv-ex-analysis-v1', JSON.stringify({ cvText: 'flat shape' }));
    expect(detectLegacyCache().cvText).toBe('flat shape');
  });
});

describe('clearLegacyCache', () => {
  it('removes all legacy keys; leaves current untouched', () => {
    const session = ((globalThis as unknown as WindowSlot).window as { sessionStorage: MockStorage }).sessionStorage;
    session.setItem('cv-ex-analysis-v1', '{"state":{"cvText":"x"}}');
    session.setItem(CURRENT_STORAGE_KEY, 'keep-me');

    clearLegacyCache();

    expect(session.getItem('cv-ex-analysis-v1')).toBeNull();
    expect(session.getItem(CURRENT_STORAGE_KEY)).toBe('keep-me');
  });
});

describe('isBannerDismissed + markBannerDismissed', () => {
  it('default false', () => {
    expect(isBannerDismissed()).toBe(false);
  });

  it('mark + read flips to true; also clears legacy', () => {
    const win = (globalThis as unknown as WindowSlot).window as { sessionStorage: MockStorage };
    const session = win.sessionStorage;
    session.setItem('cv-ex-analysis-v1', '{"state":{"cvText":"x"}}');

    markBannerDismissed();
    expect(isBannerDismissed()).toBe(true);
    expect(session.getItem('cv-ex-analysis-v1')).toBeNull();
  });
});

describe('SSR safety (no window)', () => {
  beforeEach(() => { delete (globalThis as unknown as WindowSlot).window; });
  it('detectLegacyCache returns {found:false} without window', () => {
    expect(detectLegacyCache()).toEqual({ found: false, oldKey: null, cvText: null });
  });
  it('isBannerDismissed returns false without window', () => {
    expect(isBannerDismissed()).toBe(false);
  });
  it('clearLegacyCache + markBannerDismissed are no-ops without window', () => {
    expect(() => clearLegacyCache()).not.toThrow();
    expect(() => markBannerDismissed()).not.toThrow();
  });
});
