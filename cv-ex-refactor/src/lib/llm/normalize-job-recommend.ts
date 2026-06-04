import { z } from 'zod';
import type { Job } from '@/lib/jobs/types';
import { tierFromScore, enforceQuota, type TierLetter } from '@/lib/jobs/fit-tier';

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
  // Allow 1-3 topics: Wave A tightens prompt to "max 3"; low-tier jobs may emit 1-2.
  studyTopics: z.array(StudyTopicSchema).min(1).max(5),
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
  /** Full JD text — included so /refined-cv refine can run without re-fetching the job. */
  description: string;
  overallScore: number;
  tier: TierLetter;
  dimensionScores: z.infer<typeof DimensionScoresSchema>;
  matchReasons: string[];
  studyTopics: StudyTopicOut[];
  /**
   * v0.4 hard-gate requirements parsed at ingest. Undefined on legacy jobs;
   * Job Fit detail UI conditionally renders. Ingest enhancement is tracked
   * separately — see [[project_v04_pivot_cv_solo_analyze]] follow-ups.
   */
  mustHaves?: string[];
}

// ── Normalizer ─────────────────────────────────────────────────────────────

/**
 * Parse, validate, filter, and enrich the raw LLM response.
 *
 * Drops:
 *  - entries that fail zod parse (invalid shape / missing dimensionScores)
 *  - entries whose jobId is not in jobsById (hallucinated id)
 *
 * Server-derives tier from overallScore — any LLM-emitted tier is ignored.
 * Sorts desc by overallScore, then applies per-tier quota (max 10 total).
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

    const job = jobsById.get(match.jobId);
    if (!job) continue; // LLM hallucinated a jobId not in our candidate set

    results.push({
      jobId: match.jobId,
      title: job.title,
      company: job.company,
      location: job.location,
      sourceUrl: job.sourceUrl,
      description: job.description,
      overallScore: match.overallScore,
      tier: tierFromScore(match.overallScore),
      dimensionScores: match.dimensionScores,
      matchReasons: match.matchReasons,
      studyTopics: match.studyTopics,
      ...(job.mustHaves && job.mustHaves.length > 0 ? { mustHaves: job.mustHaves } : {}),
    });
  }

  results.sort((a, b) => b.overallScore - a.overallScore);
  return enforceQuota(results);
}
