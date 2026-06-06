/**
 * Job Fit API client — wraps /api/jobs/recommend and /api/topics/feedback.
 * Error normalization mirrors career-path/api-client.ts pattern.
 */

import { appendSeenIds, getSeenIds } from '@/lib/client/anon-seen';
import { buildErrorMessage, parseErrorBody } from '@/lib/llm/humanize-error';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export interface RecommendResponse {
  jobs: JobMatchOut[];
  fromCache: boolean;
  expiresAt?: string;
  quotaRemaining?: number | null;
  // Phase 7 — Job Fit pool exhaustion signals. Present on Postgres path only.
  tier?: 'anon' | 'free' | 'paid';
  seenPolicy?: 'persisted' | 'client';
  exhaustedPool?: boolean;
  seenCount?: number;
  message?: 'no_more_new_matches' | 'pool_empty';
}

/**
 * POST /api/jobs/recommend — throws humanized Error on non-2xx.
 *
 * Anon dedup: reads sessionStorage `seenIds` into the request body BEFORE the
 * call, then appends the response's jobIds back AFTER. Signed-in dedup is
 * server-side; the seenIds passthrough is harmless for them (server prefers
 * NOT EXISTS over excludeIds when both present).
 */
export async function fetchRecommendations(cvText: string): Promise<RecommendResponse> {
  const seenIds = getSeenIds();
  const res = await fetch('/api/jobs/recommend', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(seenIds.length > 0 ? { cvText, seenIds } : { cvText }),
    credentials: 'same-origin',
  });

  if (!res.ok) {
    throw new Error(
      buildErrorMessage(await parseErrorBody(res), 'Đề xuất job thất bại'),
    );
  }

  const data = (await res.json()) as RecommendResponse;
  if (data.jobs?.length) {
    appendSeenIds(data.jobs.map((j) => j.jobId));
  }
  return data;
}

/** POST /api/admin/seen/reset — clears the signed-in user's seen list. */
export async function resetSeenJobs(): Promise<{ ok: boolean; deleted: number }> {
  const res = await fetch('/api/admin/seen/reset', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(
      buildErrorMessage(await parseErrorBody(res), 'Reset seen jobs thất bại'),
    );
  }
  return res.json() as Promise<{ ok: boolean; deleted: number }>;
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
