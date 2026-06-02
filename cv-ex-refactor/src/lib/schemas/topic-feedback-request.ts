import { z } from 'zod';

// Strict schema — rejects any unknown keys (including `reason`).
// jobId = 16 lowercase hex chars (sha256 slice as per job.id convention).
export const TopicFeedbackRequestSchema = z
  .object({
    jobId: z.string().regex(/^[a-f0-9]{16}$/, 'jobId must be 16 lowercase hex chars'),
    topicId: z.string().min(1).max(200),
    action: z.literal('dislike'),
  })
  .strict();

export type TopicFeedbackRequest = z.infer<typeof TopicFeedbackRequestSchema>;
