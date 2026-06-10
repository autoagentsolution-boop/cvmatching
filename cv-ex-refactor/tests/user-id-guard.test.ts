// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runUserIdGuard } from '@/features/auth/use-user-id-guard';
import { LAST_USER_ID_KEY, clearAllUserCaches } from '@/lib/storage/clear-user-caches';

const SEED_LOCAL = {
  'cv-ex-settings-v1': '{"provider":"gemini","model":"gemini-flash-latest"}',
  'cv-ex-career-path-v1': '{"roadmap":"alice-private-content"}',
  'cv-ex-analysis-banner-dismissed': '1',
};
const SEED_SESSION = {
  'cv-ex-analysis-v4': '{"cvText":"alice CV"}',
  'cv-ex-analysis-v3': '{"legacy":true}',
  'job-fit-matches:v2': '{"jobs":["a","b"]}',
  'refined-cv-text:v1': 'alice refined CV markdown',
};

function seedAll(userId: string | null) {
  for (const [k, v] of Object.entries(SEED_LOCAL)) localStorage.setItem(k, v);
  for (const [k, v] of Object.entries(SEED_SESSION)) sessionStorage.setItem(k, v);
  if (userId !== null) localStorage.setItem(LAST_USER_ID_KEY, userId);
}

function expectAllCleared() {
  for (const k of Object.keys(SEED_LOCAL)) expect(localStorage.getItem(k)).toBeNull();
  for (const k of Object.keys(SEED_SESSION)) expect(sessionStorage.getItem(k)).toBeNull();
}

function expectAllPreserved() {
  for (const [k, v] of Object.entries(SEED_LOCAL)) expect(localStorage.getItem(k)).toBe(v);
  for (const [k, v] of Object.entries(SEED_SESSION)) expect(sessionStorage.getItem(k)).toBe(v);
}

describe('runUserIdGuard — transition handler', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('purges and records when prior user A → user B', () => {
    seedAll('user-A');
    const result = runUserIdGuard('user-B', localStorage, clearAllUserCaches);
    expect(result).toBe('purged');
    expectAllCleared();
    expect(localStorage.getItem(LAST_USER_ID_KEY)).toBe('user-B');
  });

  it('purges and clears marker on signout (A → null)', () => {
    seedAll('user-A');
    const result = runUserIdGuard(null, localStorage, clearAllUserCaches);
    expect(result).toBe('purged');
    expectAllCleared();
    expect(localStorage.getItem(LAST_USER_ID_KEY)).toBeNull();
  });

  it('records marker but does NOT purge on first signin (no prior marker)', () => {
    // user-A signs in for the first time on this browser — their own data
    // should NOT be wiped just because the marker was missing.
    seedAll(null);
    const result = runUserIdGuard('user-A', localStorage, clearAllUserCaches);
    expect(result).toBe('recorded');
    expectAllPreserved();
    expect(localStorage.getItem(LAST_USER_ID_KEY)).toBe('user-A');
  });

  it('no-op when identity unchanged (A → A)', () => {
    seedAll('user-A');
    const result = runUserIdGuard('user-A', localStorage, clearAllUserCaches);
    expect(result).toBe('noop');
    expectAllPreserved();
    expect(localStorage.getItem(LAST_USER_ID_KEY)).toBe('user-A');
  });

  it('no-op when anon stays anon (null → null, no prior marker)', () => {
    const result = runUserIdGuard(null, localStorage, clearAllUserCaches);
    expect(result).toBe('noop');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe('clearAllUserCaches', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes every enumerated key from both storages', () => {
    seedAll('user-A');
    clearAllUserCaches();
    expectAllCleared();
  });

  it('also purges legacy analyze keys (v1, v2, v3) to handle stale tabs', () => {
    sessionStorage.setItem('cv-ex-analysis-v1', '{"old":true}');
    sessionStorage.setItem('cv-ex-analysis-v2', '{"older":true}');
    clearAllUserCaches();
    expect(sessionStorage.getItem('cv-ex-analysis-v1')).toBeNull();
    expect(sessionStorage.getItem('cv-ex-analysis-v2')).toBeNull();
  });

  it('is safe to call when nothing is set', () => {
    expect(() => clearAllUserCaches()).not.toThrow();
  });
});
