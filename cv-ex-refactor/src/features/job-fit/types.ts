/**
 * Job Fit UI types — re-exports lib shapes + adds UI-enriched variants.
 * JobMatchOut (from normalize-job-recommend) is the canonical enriched shape
 * returned by /api/jobs/recommend and stored in sessionStorage.
 */

export type { Job, StudyTopic, Seniority, Vertical, Tier } from '@/lib/jobs/types';
export type { JobMatchOut, StudyTopicOut } from '@/lib/llm/normalize-job-recommend';

/** SessionStorage cache shape. Key: 'job-fit-matches:v1' */
export interface JobFitCache {
  cvHash: string;        // first 16 chars of sha-256 — detects CV change
  jobs: import('@/lib/llm/normalize-job-recommend').JobMatchOut[];
  fetchedAt: string;     // ISO
  expiresAt: string;     // ISO — from server response
}

/** Dislike state — tracks optimistic updates per topic within a session. */
export type DislikedTopics = Set<string>; // `${jobId}:${topicName}`

/** Tier display label mapping. */
export const TIER_LABELS: Record<'basic' | 'intermediate' | 'advanced', string> = {
  basic: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

/** Score dimension labels in Vietnamese. */
export const DIM_LABELS: Record<string, string> = {
  skills: 'Kỹ năng chuyên môn',
  experience: 'Kinh nghiệm',
  education: 'Học vấn',
  industry: 'Ngành nghề',
  seniority: 'Cấp bậc',
  location: 'Địa điểm',
  tools: 'Công cụ & Stack',
  soft: 'Kỹ năng mềm',
  domain: 'Lĩnh vực',
};

/** The 9 dimensions in display order. */
export const DIM_ORDER = [
  'skills', 'experience', 'seniority', 'tools',
  'domain', 'industry', 'education', 'location', 'soft',
] as const;
