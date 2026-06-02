// POST /api/topics/feedback — record a topic dislike signal.
// Returns 204 No Content on success; 400 on invalid/extra fields.
// Bounded list: lpush + ltrim(0, 999) per topic.
// Weekly dislike counter with 60-day TTL for aggregation in admin dashboard.

import { NextRequest, NextResponse } from 'next/server';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { TopicFeedbackRequestSchema } from '@/lib/schemas/topic-feedback-request';
// P2.2 — shared week-start helper to keep key shapes aligned with read-job-fit-stats.ts
import { weekMondayYmd } from '@/lib/usage/week-monday-ymd';

export const runtime = 'nodejs';

const LIST_MAX = 999;          // ltrim keeps indices 0..999 = 1000 items
const DISLIKE_TTL_S = 60 * 24 * 60 * 60; // 60 days

function errJson(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return errJson('invalid_json', 'Request body must be valid JSON.', 400);
  }

  const parsed = TopicFeedbackRequestSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    const msg = issue?.message ?? 'Invalid request body.';
    return errJson('invalid_input', path ? `${path}: ${msg}` : msg, 400);
  }

  const { jobId, topicId, action } = parsed.data;

  if (kvAvailable) {
    const listKey = `topic-feedback:${topicId}`;
    const dislikeKey = `dislikes:${topicId}:${weekMondayYmd()}`;
    const entry = JSON.stringify({ jobId, action, ts: Date.now() });

    await Promise.allSettled([
      // Bounded feedback list — lpush then trim to last 1000
      kv.lpush(listKey, entry).then(() => kv.ltrim(listKey, 0, LIST_MAX)),
      // Weekly dislike counter with 60-day TTL
      kv.incr(dislikeKey).then(() => kv.expire(dislikeKey, DISLIKE_TTL_S)),
    ]);
  }

  // 204 No Content — no body
  return new NextResponse(null, { status: 204 });
}
