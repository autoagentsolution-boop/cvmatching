// Unit tests for RecommendBodySchema — validates cvText length bounds
// and optional llm config field.

import { describe, it, expect } from 'vitest';
import { RecommendBodySchema } from '@/lib/schemas/job-recommend-request';

const SHORT_CV = 'x'.repeat(199);   // 1 char below min
const MIN_CV   = 'x'.repeat(200);   // exactly at min
const MAX_CV   = 'x'.repeat(20000); // exactly at max
const LONG_CV  = 'x'.repeat(20001); // 1 char above max

describe('RecommendBodySchema', () => {
  it('accepts cvText of exactly 200 chars', () => {
    const result = RecommendBodySchema.safeParse({ cvText: MIN_CV });
    expect(result.success).toBe(true);
  });

  it('accepts cvText of exactly 20000 chars', () => {
    const result = RecommendBodySchema.safeParse({ cvText: MAX_CV });
    expect(result.success).toBe(true);
  });

  it('rejects cvText shorter than 200 chars', () => {
    const result = RecommendBodySchema.safeParse({ cvText: SHORT_CV });
    expect(result.success).toBe(false);
  });

  it('rejects cvText longer than 20000 chars', () => {
    const result = RecommendBodySchema.safeParse({ cvText: LONG_CV });
    expect(result.success).toBe(false);
  });

  it('rejects missing cvText', () => {
    const result = RecommendBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-string cvText', () => {
    const result = RecommendBodySchema.safeParse({ cvText: 12345 });
    expect(result.success).toBe(false);
  });

  it('accepts valid payload with optional llm config', () => {
    const result = RecommendBodySchema.safeParse({
      cvText: MIN_CV,
      llm: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.3 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts payload without llm field (uses default)', () => {
    const result = RecommendBodySchema.safeParse({ cvText: MIN_CV });
    expect(result.success).toBe(true);
    if (result.success) {
      // llm defaults are applied by the schema
      expect(result.data.llm).toBeDefined();
    }
  });

  it('rejects llm.temperature out of range (> 1)', () => {
    const result = RecommendBodySchema.safeParse({
      cvText: MIN_CV,
      llm: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown llm provider', () => {
    const result = RecommendBodySchema.safeParse({
      cvText: MIN_CV,
      llm: { provider: 'anthropic', model: 'claude-3', temperature: 0.3 },
    });
    expect(result.success).toBe(false);
  });
});
