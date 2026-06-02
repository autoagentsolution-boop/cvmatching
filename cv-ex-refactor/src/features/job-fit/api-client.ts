/**
 * Job Fit API client — wraps /api/jobs/recommend and /api/topics/feedback.
 * Error normalization mirrors career-path/api-client.ts pattern.
 */

import { buildErrorMessage, parseErrorBody } from '@/lib/llm/humanize-error';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export interface RecommendResponse {
  jobs: JobMatchOut[];
  fromCache: boolean;
  expiresAt: string;
  quotaRemaining: number | null;
}

/** POST /api/jobs/recommend — throws humanized Error on non-2xx. */
export async function fetchRecommendations(cvText: string): Promise<RecommendResponse> {
  const res = await fetch('/api/jobs/recommend', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ cvText }),
    credentials: 'same-origin',
  });

  if (!res.ok) {
    throw new Error(
      buildErrorMessage(await parseErrorBody(res), 'Đề xuất job thất bại'),
    );
  }

  return res.json() as Promise<RecommendResponse>;
}

/**
 * POST /api/topics/feedback — fire-and-forget dislike signal.
 *
 * Per spec: Phase 4 ships this route. Until then, 404 is silently ignored.
 * 401/429/4xx/5xx are logged (not thrown) so the UI stays optimistic.
 */
export async function postDislike(jobId: string, topicName: string): Promise<void> {
  try {
    const res = await fetch('/api/topics/feedback', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ jobId, topicId: topicName, action: 'dislike' }),
      credentials: 'same-origin',
    });

    if (res.status === 404) {
      // Route not yet deployed (Phase 4) — expected, log only.
      console.debug('[job-fit] /api/topics/feedback not yet deployed (404), skipping.');
      return;
    }

    if (!res.ok) {
      const body = await parseErrorBody(res);
      console.warn('[job-fit] dislike feedback failed:', body.code, body.message);
      // Re-throw so caller can revert optimistic update on persistent errors.
      throw new Error(buildErrorMessage(body, 'Gửi phản hồi thất bại'));
    }
  } catch (e) {
    if (e instanceof TypeError) {
      // Network error — log, don't propagate (fire-and-forget intent).
      console.warn('[job-fit] dislike network error:', e.message);
      return;
    }
    throw e;
  }
}
