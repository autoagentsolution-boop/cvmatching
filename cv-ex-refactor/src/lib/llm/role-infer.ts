// v0.4 role-inference orchestrator.
//
// Two-stage analyze flow: this runs FIRST. If confidence >= threshold, the
// route proceeds straight to scoring with the inferred role. Otherwise the
// route returns { needsRoleConfirm, candidates } and the UI surfaces a
// modal so the user picks/types the correct role before scoring fires.
//
// Errors surface per [[feedback_error_surfacing_no_silent_fallback]] —
// never silently default to a role.
//
// See plans/260604-1356-v04-cv-solo-analyze-pivot/phase-02-api-analyze-refactor.md

import { z } from 'zod';
import { callLLM, type LlmCallResult } from './providers';
import { safeParseJson } from './safe-parse-json';
import { buildRoleInferPrompts } from './role-infer-prompt';
import type { LlmConfigT } from '@/lib/schemas/llm-request';
import type { Language } from '@/features/analyze/types';

export const RoleInferResultSchema = z.object({
  canonical: z.string().min(2).max(120),
  confidence: z.number().min(0).max(1),
  alternates: z.array(z.string().min(2).max(120)).max(3).default([]),
});

export type RoleInferResult = z.infer<typeof RoleInferResultSchema>;

export interface InferRoleInputs {
  cvText: string;
  language?: Language;
  llm: LlmConfigT & { apiKey: string };
  signal?: AbortSignal;
}

export interface InferRoleSuccess {
  ok: true;
  result: RoleInferResult;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
}

export interface InferRoleFailure {
  ok: false;
  status: number;
  code: 'role_infer_parse_failed' | 'role_infer_invalid_shape' | 'role_infer_provider_error' | 'llm_transient';
  message: string;
  rawHead?: string;
}

export type InferRoleResponse = InferRoleSuccess | InferRoleFailure;

const DEFAULT_THRESHOLD = 0.75;

export function getConfidenceThreshold(): number {
  const env = process.env.ROLE_INFER_CONFIDENCE_THRESHOLD;
  if (!env) return DEFAULT_THRESHOLD;
  const parsed = Number.parseFloat(env);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : DEFAULT_THRESHOLD;
}

export function isHighConfidence(result: RoleInferResult, threshold = getConfidenceThreshold()): boolean {
  return result.confidence >= threshold;
}

export function buildCandidates(result: RoleInferResult): Array<{ canonical: string; confidence: number }> {
  const head = { canonical: result.canonical, confidence: round2(result.confidence) };
  const tail = result.alternates.map((canonical, i) => ({
    canonical,
    confidence: round2(Math.max(0, result.confidence - 0.1 * (i + 1))),
  }));
  return [head, ...tail];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Parse + validate raw LLM output. Exposed for unit tests so the parsing
 * contract is verified without burning real LLM calls.
 */
export function parseRoleInferResponse(raw: string): InferRoleResponse {
  const parsed = safeParseJson(raw);
  if (!parsed) {
    return {
      ok: false,
      status: 502,
      code: 'role_infer_parse_failed',
      message:
        'LLM trả về JSON không hợp lệ ở bước nhận diện vai trò. Thử lại hoặc đổi model.',
      ...(raw.length > 0 ? { rawHead: raw.slice(0, 200) } : {}),
    };
  }
  const validated = RoleInferResultSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      status: 502,
      code: 'role_infer_invalid_shape',
      message:
        'LLM nhận diện vai trò trả về cấu trúc không hợp lệ. Vui lòng thử lại.',
    };
  }
  return {
    ok: true,
    result: validated.data,
    promptTokens: undefined,
    completionTokens: undefined,
  };
}

export async function inferRoleFromCv(inputs: InferRoleInputs): Promise<InferRoleResponse> {
  const { cvText, language, llm, signal } = inputs;
  const { system, user } = buildRoleInferPrompts({ cvText, ...(language ? { language } : {}) });

  let call: LlmCallResult;
  try {
    call = await callLLM({
      config: llm,
      system,
      user,
      expectJson: true,
      maxOutputTokens: 400,
      ...(signal ? { signal } : {}),
      disableThinking: true,
    });
  } catch (e) {
    const rawMessage = e instanceof Error ? e.message : String(e);
    // humanize before surfacing — friendly Vietnamese text instead of raw
    // "Gemini 503: {...}" JSON dump that users can't action on.
    const { humanizeLlmError, isTransientLlmError } = await import('./humanize-error');
    const humanized = humanizeLlmError(rawMessage);
    return {
      ok: false,
      // Transient (5xx/429/timeout) keeps 502 so client renders soft retry UX;
      // hard provider errors (401/403/invalid key) still 502 but message routes
      // to a different banner. transient flag carried in the code.
      status: 502,
      code: isTransientLlmError(rawMessage) ? 'llm_transient' : 'role_infer_provider_error',
      message: humanized,
    };
  }

  const parsed = parseRoleInferResponse(call.text);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    result: parsed.result,
    promptTokens: call.promptTokens,
    completionTokens: call.completionTokens,
  };
}
