// Integration test for GET /api/r/[jobId] redirect route.
// Skipped unless KV env vars are present — no KV mocking per project rules.
// Seeds one job directly via repo, hits the route handler, asserts 302 + Location.

import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

const hasEnv =
  !!process.env.KV_REST_API_URL &&
  !!process.env.KV_REST_API_TOKEN;

// Namespaced test job id — 16 lowercase hex chars as required by job schema.
// Prefix 'test' ensures teardown can identify test artefacts.
const TEST_JOB_ID = 'test000000000001';

describe.skipIf(!hasEnv)(
  'GET /api/r/[jobId] — integration (real KV)',
  () => {
    afterAll(async () => {
      // Clean up test job written to KV to avoid polluting the active set.
      const { kv } = await import('@/lib/quota/kv-client');
      await Promise.allSettled([
        kv.del(`job:${TEST_JOB_ID}`),
        kv.srem('jobs:active', TEST_JOB_ID),
      ]);
    });

    it('seeds a job and redirects with 302 + Location header', async () => {
      // Seed job directly via KV (not via repo.saveJob to avoid test coupling)
      const { kv } = await import('@/lib/quota/kv-client');
      const testJob = {
        id: TEST_JOB_ID,
        title: 'Test Redirect Job',
        company: 'Test Co',
        vertical: 'tech',
        seniority: 'mid',
        description: 'Integration test job — safe to delete.',
        sourceUrl: 'https://example.com/jobs/test-redirect',
        source: 'other',
        location: 'HCM',
        postedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        embedding: '',
      };

      await kv.hset(`job:${TEST_JOB_ID}`, testJob as Record<string, unknown>);
      await kv.sadd('jobs:active', TEST_JOB_ID);

      const { GET } = await import('@/app/api/r/[jobId]/route');

      const req = new NextRequest(
        `http://localhost:3000/api/r/${TEST_JOB_ID}`,
        { method: 'GET' },
      );

      const res = await GET(req, {
        params: Promise.resolve({ jobId: TEST_JOB_ID }),
      });

      expect(res.status).toBe(302);
      const location = res.headers.get('location');
      expect(location).toBe('https://example.com/jobs/test-redirect');
    });

    it('returns 400 for invalid jobId format', async () => {
      const { GET } = await import('@/app/api/r/[jobId]/route');

      const req = new NextRequest(
        'http://localhost:3000/api/r/not-a-valid-id',
        { method: 'GET' },
      );

      const res = await GET(req, {
        params: Promise.resolve({ jobId: 'not-a-valid-id' }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent jobId', async () => {
      const { GET } = await import('@/app/api/r/[jobId]/route');

      const req = new NextRequest(
        'http://localhost:3000/api/r/ffff000000000000',
        { method: 'GET' },
      );

      const res = await GET(req, {
        params: Promise.resolve({ jobId: 'ffff000000000000' }),
      });

      // This id should not exist in KV
      expect(res.status).toBe(404);
    });
  },
);
