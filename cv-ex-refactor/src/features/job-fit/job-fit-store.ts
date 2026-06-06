'use client';

/**
 * Job Fit zustand store — sessionStorage backed (mirrors career-path-store pattern).
 * Key: 'job-fit-matches:v2' (v1→v2: JobMatchOut gained `tier` field in Wave A)
 *
 * Lifecycle:
 *  idle     → generate() called → loading → success | error
 *  success  → dislike(jobId, topicName) dimms topic optimistically
 *  clear()  → back to idle
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fetchRecommendations } from './api-client';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface JobFitState {
  cvHash: string | null;
  jobs: JobMatchOut[];
  fetchedAt: string | null;
  expiresAt: string | null;
  status: Status;
  error: string | null;
  quotaRemaining: number | null;
  /** Set of `${jobId}:${topicName}` — optimistically disliked topics. */
  dislikedKeys: string[];
  /** Phase 7 — set when server indicates the user has seen all candidates. */
  exhaustedPool: boolean;
  emptyReason: 'no_more_new_matches' | 'pool_empty' | null;
  seenPolicy: 'persisted' | 'client' | null;

  generate: (cvText: string) => Promise<void>;
  dislike: (jobId: string, topicName: string) => void;
  revertDislike: (jobId: string, topicName: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'job-fit-matches:v2';

/** Cheap hash — first 16 chars of cvText is enough to detect CV change mid-session. */
export function cvTextHash(cvText: string): string {
  return cvText.trim().slice(0, 16);
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}

const initial = {
  cvHash: null as string | null,
  jobs: [] as JobMatchOut[],
  fetchedAt: null as string | null,
  expiresAt: null as string | null,
  status: 'idle' as Status,
  error: null as string | null,
  quotaRemaining: null as number | null,
  dislikedKeys: [] as string[],
  exhaustedPool: false,
  emptyReason: null as 'no_more_new_matches' | 'pool_empty' | null,
  seenPolicy: null as 'persisted' | 'client' | null,
};

export const useJobFit = create<JobFitState>()(
  persist(
    (set, get) => ({
      ...initial,

      generate: async (cvText: string) => {
        // Guard against double-click / StrictMode double-mount → prevents duplicate API calls.
        if (get().status === 'loading') return;
        set({ status: 'loading', error: null });
        try {
          const res = await fetchRecommendations(cvText);
          set({
            cvHash: cvTextHash(cvText),
            jobs: res.jobs,
            fetchedAt: new Date().toISOString(),
            expiresAt: res.expiresAt ?? null,
            status: 'success',
            error: null,
            quotaRemaining: res.quotaRemaining ?? null,
            dislikedKeys: [],
            exhaustedPool: Boolean(res.exhaustedPool),
            emptyReason: res.message ?? null,
            seenPolicy: res.seenPolicy ?? null,
          });
        } catch (e) {
          set({
            status: 'error',
            error: e instanceof Error ? e.message : 'Đề xuất job thất bại.',
          });
        }
      },

      dislike: (jobId, topicName) => {
        const key = `${jobId}:${topicName}`;
        const cur = get().dislikedKeys;
        if (!cur.includes(key)) {
          set({ dislikedKeys: [...cur, key] });
        }
      },

      revertDislike: (jobId, topicName) => {
        const key = `${jobId}:${topicName}`;
        set({ dislikedKeys: get().dislikedKeys.filter((k) => k !== key) });
      },

      clear: () => set(initial),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        cvHash: s.cvHash,
        jobs: s.jobs,
        fetchedAt: s.fetchedAt,
        expiresAt: s.expiresAt,
        status: s.status === 'loading' ? 'idle' : s.status,
        error: s.error,
        quotaRemaining: s.quotaRemaining,
        dislikedKeys: s.dislikedKeys,
        exhaustedPool: s.exhaustedPool,
        emptyReason: s.emptyReason,
        seenPolicy: s.seenPolicy,
      }),
    },
  ),
);

/** True if cached data is present and not yet expired. */
export function isCacheValid(state: Pick<JobFitState, 'jobs' | 'expiresAt' | 'status'>): boolean {
  return state.jobs.length > 0 && state.status === 'success' && !isExpired(state.expiresAt);
}
