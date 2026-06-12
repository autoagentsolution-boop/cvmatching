// Request body schemas for /api/interview/* routes.
//
// Shared LlmConfig (provider + model + temperature) so BYOK key resolution
// + provider dispatch reuses the same machinery as analyze/generate-cv.
// `locale` is optional — defaults to 'auto' which lets the LLM mirror the
// CV/role language.

import { z } from 'zod';
import { LanguageEnum, LlmConfig } from './llm-request';

// ─── /api/interview/start ─────────────────────────────────────────────────

export const InterviewStartBody = z
  .object({
    llm: LlmConfig,
    mode: z.enum(['job_fit', 'standalone']),
    /** Required when mode === 'job_fit'. References jobs.id (Postgres). */
    jobId: z.string().min(1).max(200).optional(),
    /** Required when mode === 'standalone'. Free-text target role title. */
    roleTitle: z.string().min(2).max(160).optional(),
    /** CV library row id — anchor role context comes from this CV's content. */
    cvId: z.string().min(1).max(200),
    /** Free-text role title within the anchor CV (e.g. "Backend Engineer"). */
    anchorRoleTitle: z.string().min(2).max(160),
    locale: LanguageEnum.default('auto'),
  })
  .refine(
    (v) => (v.mode === 'job_fit' ? !!v.jobId : true),
    { message: 'jobId required when mode = job_fit', path: ['jobId'] },
  )
  .refine(
    (v) => (v.mode === 'standalone' ? !!v.roleTitle : true),
    { message: 'roleTitle required when mode = standalone', path: ['roleTitle'] },
  );

export type InterviewStartBodyT = z.infer<typeof InterviewStartBody>;

// ─── /api/interview/submit ────────────────────────────────────────────────

export const InterviewSubmitBody = z.object({
  llm: LlmConfig,
  sessionId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        id: z.string().regex(/^q([1-9]|10)$/),
        answer: z.string().min(1).max(4000),
      }),
    )
    .length(10),
  locale: LanguageEnum.default('auto'),
});

export type InterviewSubmitBodyT = z.infer<typeof InterviewSubmitBody>;

// ─── /api/interview/history ───────────────────────────────────────────────

export const InterviewHistoryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type InterviewHistoryQueryT = z.infer<typeof InterviewHistoryQuery>;
