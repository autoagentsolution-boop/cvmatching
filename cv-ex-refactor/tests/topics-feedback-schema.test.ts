import { describe, it, expect } from 'vitest';
import { z } from 'zod';

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

describe('topicFeedbackSchema', () => {
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
