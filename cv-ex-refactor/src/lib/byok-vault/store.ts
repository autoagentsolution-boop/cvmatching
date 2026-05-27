import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { encryptKey, decryptKey } from './encrypt-key';

export const BYOK_COOKIE_NAME = 'byok-token';
export const BYOK_COOKIE_MAX_AGE = 4 * 60 * 60; // 4 hours

function vaultKey(token: string): string {
  return `byok:${token}`;
}

/**
 * Encrypt the plaintext API key and persist to KV with TTL. Returns an opaque
 * token (UUID) that the browser carries in an httpOnly cookie.
 */
export async function storeKey(plain: string): Promise<string | null> {
  if (!kvAvailable) return null;
  const trimmed = plain.trim();
  if (!trimmed) return null;

  const token = crypto.randomUUID();
  const cipher = await encryptKey(trimmed);
  try {
    await kv.set(vaultKey(token), cipher, { ex: BYOK_COOKIE_MAX_AGE });
    return token;
  } catch (e) {
    console.warn('[byok-vault] kv_set_failed', {
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Look up + decrypt the API key for a given token. Returns null if the token
 * is unknown, expired, or KV is down.
 */
export async function getKey(token: string | undefined | null): Promise<string | null> {
  if (!token || !kvAvailable) return null;
  try {
    const cipher = await kv.get<string>(vaultKey(token));
    if (typeof cipher !== 'string') return null;
    return await decryptKey(cipher);
  } catch (e) {
    console.warn('[byok-vault] kv_get_failed', {
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function clearKey(token: string | undefined | null): Promise<void> {
  if (!token || !kvAvailable) return;
  try {
    await kv.del(vaultKey(token));
  } catch {
    // best-effort delete
  }
}

/**
 * Return last-4 of the stored key for UI display ("…abcd"). Lets the user
 * confirm a key is registered without exposing the full value.
 */
export async function getKeyTail(token: string | undefined | null): Promise<string | null> {
  const key = await getKey(token);
  if (!key) return null;
  return key.slice(-4);
}
