import { env } from '@/lib/env';

const ALGO = 'AES-GCM';
const IV_BYTES = 12;
const KEY_INFO = 'byok-vault:v1';

function secret(): string {
  // Same fallback as auth.ts dev path. Production guards on AUTH_SECRET in env.ts/auth.ts.
  return env.AUTH_SECRET ?? 'dev-only-secret-replace-via-AUTH_SECRET-env';
}

async function deriveAesKey(): Promise<CryptoKey> {
  const seed = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode(KEY_INFO),
    },
    seed,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptKey(plain: string): Promise<string> {
  const aes = await deriveAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt({ name: ALGO, iv }, aes, new TextEncoder().encode(plain));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return Buffer.from(out).toString('base64url');
}

export async function decryptKey(cipher: string): Promise<string | null> {
  try {
    const buf = Buffer.from(cipher, 'base64url');
    if (buf.length <= IV_BYTES) return null;
    const iv = buf.subarray(0, IV_BYTES);
    const ct = buf.subarray(IV_BYTES);
    const aes = await deriveAesKey();
    const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, aes, ct);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
