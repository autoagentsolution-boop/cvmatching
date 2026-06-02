import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { TopicFeedbackRequestSchema } from '@/lib/schemas/topic-feedback-request';

/**
 * Forward-looking regression test for the topic-feedback payload schema.
 * The actual /api/topics/[topicId]/feedback route lands in Phase 4 and will
 * re-export this schema. The 'reason' field is intentionally excluded to
 * prevent free-form PII collection through the feedback channel (Phase 0 spec §F4).
 */
const topicFeedbackSchema = z
  .object({
    jobId: z.string(),
    topicId: z.string(),
    action: z.literal('dislike'),
  })
  .strict();

// Valid 16-char hex jobId used across the real-schema tests below.
const VALID_JOB_ID = 'aabbccdd00112233';

describe('topicFeedbackSchema (inline — Phase 0 regression)', () => {
  it('accepts a valid dislike payload', () => {
    const result = topicFeedbackSchema.safeParse({
      jobId: 'j1',
      topicId: 't1',
      action: 'dislike',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload containing a reason field (no free-text PII channel)', () => {
    const result = topicFeedbackSchema.safeParse({
      jobId: 'j1',
      topicId: 't1',
      action: 'dislike',
      reason: 'something',
    });
    expect(result.success).toBe(false);
  });
});

// ── Real schema (Phase 4) — TopicFeedbackRequestSchema ───────────────────────

describe('TopicFeedbackRequestSchema (real — Phase 4)', () => {
  it('accepts valid payload with 16-hex jobId', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      jobId: VALID_JOB_ID,
      topicId: 'react-hooks',
      action: 'dislike',
    });
    expect(result.success).toBe(true);
  });

  it('rejects jobId shorter than 16 hex chars', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      jobId: 'aabbccdd001122',     // 14 chars
      topicId: 'react-hooks',
      action: 'dislike',
    });
    expect(result.success).toBe(false);
  });

  it('rejects jobId longer than 16 hex chars', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      jobId: 'aabbccdd0011223344', // 18 chars
      topicId: 'react-hooks',
      action: 'dislike',
    });
    expect(result.success).toBe(false);
  });

  it('rejects jobId with uppercase hex chars', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      jobId: 'AABBCCDD00112233',
      topicId: 'react-hooks',
      action: 'dislike',
    });
    expect(result.success).toBe(false);
  });

  it('rejects jobId with non-hex chars', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      jobId: 'zzzzzzzz00112233',
      topicId: 'react-hooks',
      action: 'dislike',
    });
    expect(result.success).toBe(false);
  });

  it('rejects payload with reason field (strict mode)', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      jobId: VALID_JOB_ID,
      topicId: 'react-hooks',
      action: 'dislike',
      reason: 'meh',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown extra field (strict mode)', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      jobId: VALID_JOB_ID,
      topicId: 'react-hooks',
      action: 'dislike',
      extra: 'surprise',
    });
    expect(result.success).toBe(false);
  });

  it('rejects action other than "dislike"', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      jobId: VALID_JOB_ID,
      topicId: 'react-hooks',
      action: 'like',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty topicId', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      jobId: VALID_JOB_ID,
      topicId: '',
      action: 'dislike',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing jobId', () => {
    const result = TopicFeedbackRequestSchema.safeParse({
      topicId: 'react-hooks',
      action: 'dislike',
    });
    expect(result.success).toBe(false);
  });
});
