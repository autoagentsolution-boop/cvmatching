// Unit tests for the /api/analyze v2-vs-v3 dispatcher.
//
// Full end-to-end (real LLM + KV) is verified manually in preview/dev;
// heavily mocking resolveApiKey + callLLM + cost-guard for a route test
// would mostly assert the mocks, not the contract. Here we cover the
// pure dispatcher and shape detection.

import { describe, it, expect } from 'vitest';
import { isV3Shape } from '@/lib/analyze/dispatch';

describe('isV3Shape (dispatcher)', () => {
  it('returns true for v3 body (cvText only, no jdText)', () => {
    expect(
      isV3Shape({
        llm: { provider: 'gemini', model: 'gemini-1.5-pro' },
        inputs: { cvText: 'x'.repeat(150) },
      }),
    ).toBe(true);
  });

  it('returns true for v3 body with user-confirmed role', () => {
    expect(
      isV3Shape({
        llm: { provider: 'gemini', model: 'gemini-1.5-pro' },
        inputs: { cvText: 'x'.repeat(150), role: 'Senior Backend Engineer' },
      }),
    ).toBe(true);
  });

  it('returns false for v2 body (jdText present)', () => {
    expect(
      isV3Shape({
        llm: { provider: 'gemini', model: 'gemini-1.5-pro' },
        inputs: {
          jdText: 'some JD',
          cvText: 'x'.repeat(150),
          targetRole: 'software',
          strictness: 'balanced',
          language: 'auto',
          mustHaves: [],
        },
      }),
    ).toBe(false);
  });

  it('returns false for malformed (no inputs key)', () => {
    expect(isV3Shape({ llm: {} })).toBe(false);
  });

  it('returns false for null/undefined/non-object body', () => {
    expect(isV3Shape(null)).toBe(false);
    expect(isV3Shape(undefined)).toBe(false);
    expect(isV3Shape('string')).toBe(false);
    expect(isV3Shape(42)).toBe(false);
  });

  it('returns false when inputs is not an object', () => {
    expect(isV3Shape({ inputs: 'oops' })).toBe(false);
  });
});
