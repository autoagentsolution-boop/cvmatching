import { z } from 'zod';
import type { Job } from '@/lib/jobs/types';

// ── Raw LLM output schema ──────────────────────────────────────────────────

const DimensionScoresSchema = z.object({
  skills: z.number(),
  experience: z.number(),
  education: z.number(),
  industry: z.number(),
  seniority: z.number(),
  location: z.number(),
  tools: z.number(),
  soft: z.number(),
  domain: z.number(),
});

const StudyTopicSchema = z.object({
  name: z.string(),
  category: z.enum(['frontend', 'backend', 'db', 'devops', 'soft', 'domain']),
  tier: z.enum(['basic', 'intermediate', 'advanced']),
  whyForThisJob: z.string(),
  estimatedHours: z.string(),
});

const RawMatchSchema = z.object({
  jobId: z.string(),
  overallScore: z.number().min(0).max(100),
  dimensionScores: DimensionScoresSchema,
  matchReasons: z.array(z.string()).min(1).max(8),
  studyTopics: z.array(StudyTopicSchema).min(3).max(12),
});

const RawResponseSchema = z.object({
  jobs: z.array(RawMatchSchema),
});

// ── Enriched output type (what the route returns to the client) ────────────

export interface StudyTopicOut {
  name: string;
  category: 'frontend' | 'backend' | 'db' | 'devops' | 'soft' | 'domain';
  tier: 'basic' | 'intermediate' | 'advanced';
  whyForThisJob: string;
  estimatedHours: string;
}

export interface JobMatchOut {
  jobId: string;
  title: string;
  company: string;
  location: string;
  sourceUrl: string;
  overallScore: number;
  dimensionScores: z.infer<typeof DimensionScoresSchema>;
  matchReasons: string[];
  studyTopics: StudyTopicOut[];
}

// ── Normalizer ─────────────────────────────────────────────────────────────

/**
 * Parse, validate, filter, and enrich the raw LLM response.
 *
 * Drops:
 *  - entries that fail zod parse (invalid shape / missing dimensionScores)
 *  - entries whose jobId is not in jobsById (hallucinated id)
 *  - entries with overallScore <= 80
 *
 * Returns up to 10 matches sorted descending by overallScore.
 */
export function normalizeRecommend(
  raw: unknown,
  jobsById: Map<string, Job>,
): JobMatchOut[] {
  const parsed = RawResponseSchema.safeParse(raw);
  if (!parsed.success) {
    // Attempt per-item recovery: if top-level parse fails, try treating raw as { jobs: unknown[] }
    const rawObj = raw as { jobs?: unknown[] } | null;
    const items = Array.isArray(rawObj?.jobs) ? rawObj.jobs : [];
    return normalizeItems(items, jobsById);
  }

  return normalizeItems(parsed.data.jobs, jobsById);
}

function normalizeItems(
  items: unknown[],
  jobsById: Map<string, Job>,
): JobMatchOut[] {
  const results: JobMatchOut[] = [];

  for (const item of items) {
    const itemParsed = RawMatchSchema.safeParse(item);
    if (!itemParsed.success) continue;

    const match = itemParsed.data;

    if (match.overallScore <= 80) continue;

    const job = jobsById.get(match.jobId);
    if (!job) continue; // LLM hallucinated a jobId not in our candidate set

    results.push({
      jobId: match.jobId,
      title: job.title,
      company: job.company,
      location: job.location,
      sourceUrl: job.sourceUrl,
      overallScore: match.overallScore,
      dimensionScores: match.dimensionScores,
      matchReasons: match.matchReasons,
      studyTopics: match.studyTopics,
    });
  }

  results.sort((a, b) => b.overallScore - a.overallScore);
  return results.slice(0, 10);
}
