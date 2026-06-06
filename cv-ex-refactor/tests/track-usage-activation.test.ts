// Activation tracking — verify trackUsage emits anon + variant sub-counters
// alongside the existing primary global counter. Mocks @/lib/quota/kv-client
// so we can assert the exact key set written per call shape.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const incrCalls: string[] = [];
const incrbyCalls: { key: string; by: number }[] = [];

vi.mock('@/lib/quota/kv-client', () => ({
  kvAvailable: true,
  kv: {
    incr: vi.fn(async (key: string) => {
      incrCalls.push(key);
      return 2; // pretend key already existed → no expire fired
    }),
    incrby: vi.fn(async (key: string, by: number) => {
      incrbyCalls.push({ key, by });
      return by + 10;
    }),
    expire: vi.fn(async () => 1),
    get: vi.fn(async () => null),
    sadd: vi.fn(async () => 1),
  },
}));

vi.mock('@/lib/llm/model-prices', () => ({
  microUsdCost: vi.fn(() => 0),
}));

vi.mock('./../src/lib/usage/alert-webhook', () => ({
  maybeFireAlerts: vi.fn(async () => undefined),
}));

vi.mock('@/lib/usage/alert-webhook', () => ({
  maybeFireAlerts: vi.fn(async () => undefined),
}));

import { trackUsage } from '@/lib/usage/track-usage';

function ymdToday(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

const YMD = ymdToday();

describe('trackUsage — activation counters', () => {
  beforeEach(() => {
    incrCalls.length = 0;
    incrbyCalls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('anon shared-key analyze v3 writes total + anon + variant + variant:anon', async () => {
    await trackUsage({
      action: 'analyze',
      status: 'ok',
      byok: false,
      variant: 'v3',
      // no userId → anon
    });

    expect(incrCalls).toContain(`usage:global:${YMD}:analyze:ok`);
    expect(incrCalls).toContain(`usage:global:${YMD}:analyze:anon:ok`);
    expect(incrCalls).toContain(`usage:global:${YMD}:analyze-v3:ok`);
    expect(incrCalls).toContain(`usage:global:${YMD}:analyze-v3:anon:ok`);
    // No signed-in pseudo-counter — derived as (total - anon) by the reader.
    expect(incrCalls).not.toContain(`usage:global:${YMD}:analyze:signed:ok`);
  });

  it('signed-in analyze v2 writes total + variant only (no anon keys)', async () => {
    await trackUsage({
      action: 'analyze',
      status: 'ok',
      byok: false,
      variant: 'v2',
      userId: 'user-123',
    });

    expect(incrCalls).toContain(`usage:global:${YMD}:analyze:ok`);
    expect(incrCalls).toContain(`usage:global:${YMD}:analyze-v2:ok`);
    expect(incrCalls).not.toContain(`usage:global:${YMD}:analyze:anon:ok`);
    expect(incrCalls).not.toContain(`usage:global:${YMD}:analyze-v2:anon:ok`);
  });

  it('BYOK anon analyze v3 skips the anon counter (BYOK = own billing)', async () => {
    await trackUsage({
      action: 'analyze',
      status: 'ok',
      byok: true,
      variant: 'v3',
    });

    expect(incrCalls).toContain(`usage:global:${YMD}:analyze:ok`);
    expect(incrCalls).toContain(`usage:global:${YMD}:analyze-v3:ok`);
    // BYOK is intentionally not counted as anon — different funnel.
    expect(incrCalls).not.toContain(`usage:global:${YMD}:analyze:anon:ok`);
    expect(incrCalls).not.toContain(`usage:global:${YMD}:analyze-v3:anon:ok`);
  });

  it('non-analyze action ignores variant tag (no pseudo-counter written)', async () => {
    await trackUsage({
      action: 'generate-cv',
      status: 'ok',
      byok: false,
      variant: 'v3' as never, // would be ignored even if smuggled in
    });

    expect(incrCalls).toContain(`usage:global:${YMD}:generate-cv:ok`);
    expect(incrCalls).toContain(`usage:global:${YMD}:generate-cv:anon:ok`);
    expect(incrCalls.some((k) => k.includes('analyze-'))).toBe(false);
  });

  it('error status routes through anon + variant counters too', async () => {
    await trackUsage({
      action: 'analyze',
      status: 'error',
      byok: false,
      variant: 'v3',
    });

    expect(incrCalls).toContain(`usage:global:${YMD}:analyze:error`);
    expect(incrCalls).toContain(`usage:global:${YMD}:analyze:anon:error`);
    expect(incrCalls).toContain(`usage:global:${YMD}:analyze-v3:error`);
    expect(incrCalls).toContain(`usage:global:${YMD}:analyze-v3:anon:error`);
  });

  it('analyze without variant writes total + anon only (no pseudo-action)', async () => {
    await trackUsage({
      action: 'analyze',
      status: 'ok',
      byok: false,
      // variant intentionally omitted
    });

    expect(incrCalls).toContain(`usage:global:${YMD}:analyze:ok`);
    expect(incrCalls).toContain(`usage:global:${YMD}:analyze:anon:ok`);
    expect(incrCalls.some((k) => k.includes('analyze-v'))).toBe(false);
  });
});
