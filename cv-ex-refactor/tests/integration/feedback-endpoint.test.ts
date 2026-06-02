// Integration test for POST /api/topics/feedback.
// Skipped unless KV env vars present — no KV mocking per project rules.
// Tests: valid payload → 204, with reason → 400, missing action → 400.

import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

const hasEnv =
  !!process.env.KV_REST_API_URL &&
  !!process.env.KV_REST_API_TOKEN;

// Valid 16-char hex jobId for feedback tests
const VALID_JOB_ID = 'aabbccdd00112233';
// Test-namespaced topicId — prevents pollution of real `react-hooks` analytics
const TEST_TOPIC_ID = `test-feedback-${Date.now().toString(36)}`;

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/topics/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!hasEnv)(
  'POST /api/topics/feedback — integration (real KV)',
  () => {
    afterAll(async () => {
      // Clean up test-namespaced keys to avoid polluting shared KV.
      const { kv } = await import('@/lib/quota/kv-client');
      const { weekMondayYmd } = await import('@/lib/usage/week-monday-ymd');
      await Promise.allSettled([
        kv.del(`topic-feedback:${TEST_TOPIC_ID}`),
        kv.del(`dislikes:${TEST_TOPIC_ID}:${weekMondayYmd()}`),
      ]);
    });

    it('valid payload returns 204 No Content', async () => {
      const { POST } = await import('@/app/api/topics/feedback/route');

      const res = await POST(makeReq({
        jobId: VALID_JOB_ID,
        topicId: TEST_TOPIC_ID,
        action: 'dislike',
      }));

      expect(res.status).toBe(204);
    });

    it('payload with extra "reason" field returns 400', async () => {
      const { POST } = await import('@/app/api/topics/feedback/route');

      const res = await POST(makeReq({
        jobId: VALID_JOB_ID,
        topicId: TEST_TOPIC_ID,
        action: 'dislike',
        reason: 'not relevant',
      }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    it('payload missing action returns 400', async () => {
      const { POST } = await import('@/app/api/topics/feedback/route');

      const res = await POST(makeReq({
        jobId: VALID_JOB_ID,
        topicId: TEST_TOPIC_ID,
        // action intentionally missing
      }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    it('invalid jobId format returns 400', async () => {
      const { POST } = await import('@/app/api/topics/feedback/route');

      const res = await POST(makeReq({
        jobId: 'not-hex',
        topicId: TEST_TOPIC_ID,
        action: 'dislike',
      }));

      expect(res.status).toBe(400);
    });

    it('empty topicId returns 400', async () => {
      const { POST } = await import('@/app/api/topics/feedback/route');

      const res = await POST(makeReq({
        jobId: VALID_JOB_ID,
        topicId: '',
        action: 'dislike',
      }));

      expect(res.status).toBe(400);
    });
  },
);
