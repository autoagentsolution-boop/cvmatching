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

// Phase 1c: estimatedHours migrates from freeform string to {min,max} so the
// UI can sort + format consistently. Legacy responses (cached pre-1c) still
// arrive as string; the union below tolerates both during a 2-week soak.
// [2026-06-24 phase 1c — remove string fallback after cache eviction]
const EstimatedHoursSchema = z.union([
  z.object({
    min: z.number().int().min(1).max(200),
    max: z.number().int().min(1).max(400),
  }),
  z.string().max(40),
]);

const StudyTopicSchema = z.object({
  name: z.string(),
  category: z.enum(['frontend', 'backend', 'db', 'devops', 'soft', 'domain']),
  tier: z.enum(['basic', 'intermediate', 'advanced']),
  whyForThisJob: z.string(),
  estimatedHours: EstimatedHoursSchema,
});

const RawMatchSchema = z.object({
  jobId: z.string(),
  overallScore: z.number().min(0).max(100),
  // Phase 1c: LLM emits tier (S/A/B/C/D); server still derives authoritative
  // tier via tierFromScore and logs drift for monitoring.
  tier: z.enum(['S', 'A', 'B', 'C', 'D', 'E']).optional(),
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
  /** Phase 1c: structured shape. Legacy cached entries hold a string. */
  estimatedHours: { min: number; max: number } | string;
}

/**
 * Parse a legacy freeform estimatedHours string ("4-8h", "1-2 ngày",
 * "khoảng 6 giờ") into the new {min,max} shape. Defensive: returns the
 * default {4,8} when nothing parses cleanly so a stale cached entry never
 * blows up rendering.
 */
export function parseLegacyEstimatedHours(raw: string): { min: number; max: number } {
  const days = raw.match(/(\d+)\s*-\s*(\d+)\s*(ngày|days?)/i);
  if (days && days[1] && days[2]) {
    return { min: Number(days[1]) * 8, max: Number(days[2]) * 8 };
  }
  const range = raw.match(/(\d+)\s*-\s*(\d+)/);
  if (range && range[1] && range[2]) {
    return { min: Number(range[1]), max: Number(range[2]) };
  }
  const single = raw.match(/(\d+)/);
  if (single && single[1]) {
    const v = Number(single[1]);
    return { min: v, max: v + 4 };
  }
  return { min: 4, max: 8 };
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
  /**
   * v0.4 Phase A — slug into the Company KV namespace. Undefined on jobs
   * ingested before Phase 02 lite (no companyId attached). Detail UI
   * conditionally renders CompanyCard only when present.
   */
  companyId?: string;
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

    const serverTier = tierFromScore(match.overallScore);
    // Drift log — non-blocking. Helps spot prompt regressions where the LLM
    // mis-maps overallScore vs tier boundaries (e.g. emits 'A' for 72).
    if (match.tier && match.tier !== serverTier) {
      console.warn('[job-fit] llm tier drift', {
        jobId: match.jobId,
        llmTier: match.tier,
        serverTier,
        overallScore: match.overallScore,
      });
    }

    // Normalize each studyTopic's estimatedHours into {min,max}. New responses
    // arrive as object; legacy cached as string — parseLegacyEstimatedHours
    // covers both. Drop the string union path after 2026-06-24.
    const studyTopics: StudyTopicOut[] = match.studyTopics.map((t) => ({
      ...t,
      estimatedHours: typeof t.estimatedHours === 'string'
        ? parseLegacyEstimatedHours(t.estimatedHours)
        : t.estimatedHours,
    }));

    results.push({
      jobId: match.jobId,
      title: job.title,
      company: job.company,
      location: job.location,
      sourceUrl: job.sourceUrl,
      description: job.description,
      overallScore: match.overallScore,
      tier: serverTier,
      dimensionScores: match.dimensionScores,
      matchReasons: match.matchReasons,
      studyTopics,
      ...(job.mustHaves && job.mustHaves.length > 0 ? { mustHaves: job.mustHaves } : {}),
      ...(job.companyId ? { companyId: job.companyId } : {}),
    });
  }

  results.sort((a, b) => b.overallScore - a.overallScore);
  return enforceQuota(results);
}
