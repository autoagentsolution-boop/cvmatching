// Unit tests for refreshBatch — mocks fetch + repo functions.
// Validates: 404/410 → expireJob, 200-ok → touchVerifiedAt,
// 200-expired-body → expireJob, network-error → errors++, deadline guard.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RefreshBatchOpts } from '@/lib/jobs/refresh-batch';

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@/lib/jobs/repo-postgres', () => ({
  getJob: vi.fn(),
  expireJob: vi.fn().mockResolvedValue(undefined),
  touchVerifiedAt: vi.fn().mockResolvedValue(undefined),
}));

// Import after mock registration
import { refreshBatch } from '@/lib/jobs/refresh-batch';
import { getJob, expireJob, touchVerifiedAt } from '@/lib/jobs/repo-postgres';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeJob(id: string, sourceUrl = `https://example.com/job/${id}`) {
  return {
    id,
    title: 'Test Job',
    company: 'Test Co',
    vertical: 'tech' as const,
    seniority: 'mid' as const,
    description: 'desc',
    sourceUrl,
    source: 'other' as const,
    location: 'HCM',
    postedAt: '2026-01-01T00:00:00Z',
    verifiedAt: '2026-01-01T00:00:00Z',
    embedding: '',
  };
}

function defaultOpts(overrides: Partial<RefreshBatchOpts> = {}): RefreshBatchOpts {
  return {
    ua: 'test-agent/1.0',
    timeoutMs: 5000,
    sleepMs: 0,
    jitterMs: 0,
    deadlineMs: Date.now() + 60_000, // 60 s in the future
    ...overrides,
  };
}

/** Build a minimal Response-like object for vi.spyOn(globalThis, 'fetch'). */
function makeResponse(status: number, body = ''): Response {
  return new Response(body, { status });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('refreshBatch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: getJob returns a valid job; callers override per test.
    vi.mocked(getJob).mockResolvedValue(makeJob('job-default'));
    vi.mocked(expireJob).mockResolvedValue(undefined);
    vi.mocked(touchVerifiedAt).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('404 response → calls expireJob, increments expired', async () => {
    const id = 'aabbccdd00112233';
    vi.mocked(getJob).mockResolvedValue(makeJob(id));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(404));

    const result = await refreshBatch([id], defaultOpts());

    expect(expireJob).toHaveBeenCalledWith(id);
    expect(touchVerifiedAt).not.toHaveBeenCalled();
    expect(result.expired).toBe(1);
    expect(result.ok).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.lastIndex).toBe(0);
  });

  it('410 response → calls expireJob, increments expired', async () => {
    const id = 'deadbeef11223344';
    vi.mocked(getJob).mockResolvedValue(makeJob(id));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(410));

    const result = await refreshBatch([id], defaultOpts());

    expect(expireJob).toHaveBeenCalledWith(id);
    expect(result.expired).toBe(1);
    expect(result.ok).toBe(0);
  });

  it('200 response with clean body → calls touchVerifiedAt, increments ok', async () => {
    const id = 'cafebabe99887766';
    vi.mocked(getJob).mockResolvedValue(makeJob(id));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(200, '<html>Job is open</html>'));

    const result = await refreshBatch([id], defaultOpts());

    expect(touchVerifiedAt).toHaveBeenCalledWith(id, expect.any(String));
    expect(expireJob).not.toHaveBeenCalled();
    expect(result.ok).toBe(1);
    expect(result.expired).toBe(0);
  });

  it('200 response with expired-body pattern → calls expireJob, increments expired', async () => {
    const id = '1122334455667788';
    vi.mocked(getJob).mockResolvedValue(makeJob(id));
    // Body matches EXPIRED_BODY_RE: "job" + gap + "expired"
    const expiredBody = '<html><title>This job has expired</title><p>This job posting is closed.</p></html>';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(200, expiredBody));

    const result = await refreshBatch([id], defaultOpts());

    expect(expireJob).toHaveBeenCalledWith(id);
    expect(touchVerifiedAt).not.toHaveBeenCalled();
    expect(result.expired).toBe(1);
    expect(result.ok).toBe(0);
  });

  it('network error (fetch throws) → increments errors, does not expire or touch', async () => {
    const id = '8877665544332211';
    vi.mocked(getJob).mockResolvedValue(makeJob(id));
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await refreshBatch([id], defaultOpts());

    expect(expireJob).not.toHaveBeenCalled();
    expect(touchVerifiedAt).not.toHaveBeenCalled();
    expect(result.errors).toBe(1);
    expect(result.ok).toBe(0);
    expect(result.expired).toBe(0);
  });

  it('getJob returns null (job disappeared from KV) → increments errors', async () => {
    const id = '0011223344556677';
    vi.mocked(getJob).mockResolvedValue(null);

    const result = await refreshBatch([id], defaultOpts());

    expect(expireJob).not.toHaveBeenCalled();
    expect(result.errors).toBe(1);
  });

  it('deadline already passed → processes 0 items, lastIndex = -1', async () => {
    const ids = ['aabb000011112222', 'ccdd333344445555'];
    vi.mocked(getJob).mockResolvedValue(makeJob(ids[0]!));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(200, 'open'));

    // deadline in the past
    const result = await refreshBatch(ids, defaultOpts({ deadlineMs: Date.now() - 1 }));

    expect(result.lastIndex).toBe(-1);
    expect(result.ok).toBe(0);
    expect(result.expired).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('non-http(s) sourceUrl → increments errors, skips fetch', async () => {
    const id = 'ffffeeeeddddcccc';
    vi.mocked(getJob).mockResolvedValue(makeJob(id, 'ftp://evil.example.com/job'));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await refreshBatch([id], defaultOpts());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.errors).toBe(1);
  });

  it('mixed batch: 200-ok + 404 + network-error → correct counters', async () => {
    const ids = ['id0000000ok00000', 'id000000404aaaaa', 'id000000erraaaaa'];
    vi.mocked(getJob)
      .mockResolvedValueOnce(makeJob(ids[0]!))
      .mockResolvedValueOnce(makeJob(ids[1]!))
      .mockResolvedValueOnce(makeJob(ids[2]!));

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeResponse(200, 'open'))
      .mockResolvedValueOnce(makeResponse(404))
      .mockRejectedValueOnce(new Error('timeout'));

    const result = await refreshBatch(ids, defaultOpts());

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(1);
    expect(result.expired).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.lastIndex).toBe(2);
  });

  it('405 HEAD response triggers GET fallback', async () => {
    const id = 'aabbaabbaabbccdd';
    vi.mocked(getJob).mockResolvedValue(makeJob(id));
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeResponse(405)) // HEAD → 405
      .mockResolvedValueOnce(makeResponse(200, 'open')); // GET fallback

    const result = await refreshBatch([id], defaultOpts());

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(1);
    expect(touchVerifiedAt).toHaveBeenCalledWith(id, expect.any(String));
  });
});
