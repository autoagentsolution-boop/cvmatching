// Unit tests for the callLLMWithFallback retry+fallback chain. We mock
// call-gemini + call-openai so the test runs offline + deterministic.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGeminiMock = vi.fn();
const callOpenAIMock = vi.fn();

vi.mock('@/lib/llm/call-gemini', () => ({
  callGemini: (...args: unknown[]) => callGeminiMock(...args),
}));
vi.mock('@/lib/llm/call-openai', () => ({
  callOpenAI: (...args: unknown[]) => callOpenAIMock(...args),
}));

import { callLLMWithFallback, geminiFallbackChain } from '@/lib/llm/providers';

const BASE = {
  config: {
    provider: 'gemini' as const,
    model: 'gemini-flash-latest',
    temperature: 0.3,
    apiKey: 'k',
  },
  system: 'sys',
  user: 'usr',
  expectJson: true,
};

beforeEach(() => {
  callGeminiMock.mockReset();
  callOpenAIMock.mockReset();
});

describe('callLLMWithFallback', () => {
  it('returns first-try success with usedFallback=false', async () => {
    callGeminiMock.mockResolvedValueOnce({ text: 'ok' });
    const res = await callLLMWithFallback(BASE);
    expect(res.text).toBe('ok');
    expect(res.usedFallback).toBe(false);
    expect(res.actualModel).toBe('gemini-flash-latest');
    expect(callGeminiMock).toHaveBeenCalledTimes(1);
  });

  it('retries same model on transient 503 then succeeds (no fallback)', async () => {
    callGeminiMock
      .mockRejectedValueOnce(new Error('Gemini 503: UNAVAILABLE — high demand'))
      .mockResolvedValueOnce({ text: 'recovered' });
    const res = await callLLMWithFallback(BASE);
    expect(res.text).toBe('recovered');
    expect(res.usedFallback).toBe(false);
    expect(callGeminiMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to next model after primary exhausts retries', async () => {
    callGeminiMock
      .mockRejectedValueOnce(new Error('Gemini 503: high demand'))
      .mockRejectedValueOnce(new Error('Gemini 503: high demand'))
      .mockResolvedValueOnce({ text: 'from-fallback' });
    const res = await callLLMWithFallback({ ...BASE, fallbackModels: ['gemini-2.5-flash'], retries: 1 });
    expect(res.text).toBe('from-fallback');
    expect(res.usedFallback).toBe(true);
    expect(res.actualModel).toBe('gemini-2.5-flash');
    expect(callGeminiMock).toHaveBeenCalledTimes(3);
  });

  it('falls through entire chain and rethrows last error when all 503', async () => {
    callGeminiMock.mockRejectedValue(new Error('Gemini 503: UNAVAILABLE'));
    await expect(
      callLLMWithFallback({ ...BASE, fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-pro'], retries: 1 }),
    ).rejects.toThrow(/503/);
    // primary: 2 attempts (retry=1 → 1 try + 1 retry) + 2 fallbacks × 1 each = 4
    expect(callGeminiMock).toHaveBeenCalledTimes(4);
  });

  it('bubbles non-transient error immediately (no retry, no fallback)', async () => {
    callGeminiMock.mockRejectedValueOnce(new Error('Gemini 400: INVALID_ARGUMENT'));
    await expect(
      callLLMWithFallback({ ...BASE, fallbackModels: ['gemini-2.5-flash'], retries: 1 }),
    ).rejects.toThrow(/400/);
    expect(callGeminiMock).toHaveBeenCalledTimes(1);
  });

  it('treats 429 rate-limit as transient and retries', async () => {
    callGeminiMock
      .mockRejectedValueOnce(new Error('Gemini 429 RESOURCE_EXHAUSTED'))
      .mockResolvedValueOnce({ text: 'after-429' });
    const res = await callLLMWithFallback(BASE);
    expect(res.text).toBe('after-429');
    expect(callGeminiMock).toHaveBeenCalledTimes(2);
  });
});

describe('geminiFallbackChain', () => {
  it('excludes the current model from the chain', () => {
    expect(geminiFallbackChain('gemini-flash-latest')).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ]);
    expect(geminiFallbackChain('gemini-2.5-flash')).toEqual([
      'gemini-flash-latest',
      'gemini-2.5-pro',
    ]);
  });

  it('returns the full chain when current model is outside the family', () => {
    expect(geminiFallbackChain('some-other-model')).toEqual([
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-2.5-pro',
    ]);
  });
});
