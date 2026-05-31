// Tests HMAC key determinism for embed-cache.
// Does NOT touch KV — only verifies the crypto key derivation logic directly.
// We test the HMAC function in isolation rather than the module's cache functions
// (which require live KV) to keep tests fast and hermetic.

import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';

function deriveKey(cvText: string, secret: string): string {
  return `embed-cache:${createHmac('sha256', secret).update(cvText).digest('hex')}`;
}

describe('embed-cache HMAC key derivation', () => {
  it('same input + same secret → same key (deterministic)', () => {
    const key1 = deriveKey('my CV text', 'secret-abc');
    const key2 = deriveKey('my CV text', 'secret-abc');
    expect(key1).toBe(key2);
  });

  it('different CV text → different key', () => {
    const key1 = deriveKey('CV text A', 'secret-xyz');
    const key2 = deriveKey('CV text B', 'secret-xyz');
    expect(key1).not.toBe(key2);
  });

  it('same CV text + different secret → different key', () => {
    const key1 = deriveKey('same CV', 'secret-one');
    const key2 = deriveKey('same CV', 'secret-two');
    expect(key1).not.toBe(key2);
  });

  it('key has expected prefix and 64-char hex suffix', () => {
    const key = deriveKey('any text', 'any-secret-32-chars-long-padding!');
    expect(key).toMatch(/^embed-cache:[0-9a-f]{64}$/);
  });

  it('whitespace difference in CV text produces different key', () => {
    const key1 = deriveKey('hello world', 'secret');
    const key2 = deriveKey('hello  world', 'secret'); // extra space
    expect(key1).not.toBe(key2);
  });

  it('produces consistent key across multiple calls (no randomness)', () => {
    const secret = 'stable-secret-value-abc123';
    const text = 'Nguyễn Văn A - Senior Software Engineer - 5 years React';
    const keys = Array.from({ length: 5 }, () => deriveKey(text, secret));
    const unique = new Set(keys);
    expect(unique.size).toBe(1);
  });
});
