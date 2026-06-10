'use client';

import { useEffect } from 'react';
import { clearAllUserCaches, LAST_USER_ID_KEY } from '@/lib/storage/clear-user-caches';

/**
 * Pure transition handler — extracted so it can be unit-tested without React.
 * Returns `'purged'` when caches were cleared, `'recorded'` when the marker
 * was just set on first signin, `'noop'` otherwise.
 */
export function runUserIdGuard(
  currentUserId: string | null,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  purge: () => void,
): 'purged' | 'recorded' | 'noop' {
  const stored = storage.getItem(LAST_USER_ID_KEY);
  const current = currentUserId ?? null;

  if (stored === null && current === null) return 'noop';

  // First signin on a fresh browser — record marker, keep their data intact.
  if (stored === null && current !== null) {
    storage.setItem(LAST_USER_ID_KEY, current);
    return 'recorded';
  }

  if (stored === current) return 'noop';

  // Identity transition (A→B, A→null, or null→B after prior session).
  purge();
  if (current === null) storage.removeItem(LAST_USER_ID_KEY);
  else storage.setItem(LAST_USER_ID_KEY, current);
  return 'purged';
}

/**
 * Detect when the signed-in user identity changes on this browser and purge
 * client-side caches from the prior user. Covers three scenarios:
 *
 *   1. user A signs out, user B signs in   (id A → null → B)
 *   2. user A is replaced without explicit signout
 *      (e.g. cookie rotation, force re-auth) — id A → B in one transition
 *   3. user A signs out and stays signed out (id A → null)
 *
 * Anonymous → signed-in transitions don't purge (anon state was theirs).
 */
export function useUserIdGuard(currentUserId: string | null | undefined): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    runUserIdGuard(currentUserId ?? null, window.localStorage, clearAllUserCaches);
  }, [currentUserId]);
}
