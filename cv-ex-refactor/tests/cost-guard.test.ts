import { describe, it, expect } from 'vitest';
import { checkKillSwitch } from '@/lib/cost/guard';

/**
 * Smoke test for checkKillSwitch.
 * In test env KV_REST_API_URL / KV_REST_API_TOKEN are unset, so kvAvailable
 * is false and checkKillSwitch returns { ok: true } without touching KV.
 */
describe('checkKillSwitch', () => {
  it('returns ok:true when KV is unavailable (no kill-switch set)', async () => {
    const result = await checkKillSwitch('job-recommend');
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
