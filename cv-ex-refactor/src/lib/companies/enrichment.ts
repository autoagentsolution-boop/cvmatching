// Company Tier 2 enrichment orchestrator. One Gemini grounded-search call
// per company per 30 days. Insufficient-source guard runs at the parse
// layer (cons items < 2 citations dropped; summary blanked if global
// sourceCount < 2) to mitigate defamation risk on auto-published claims.
//
// Errors bubble — caller (API route) decides 502 vs 429 vs degraded UI
// per [[feedback_error_surfacing_no_silent_fallback]].

import { z } from 'zod';
import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import {
  ENRICHMENT_SYSTEM,
  EnrichmentResponseSchema,
  buildEnrichmentUserPrompt,
  type EnrichmentResponse,
} from './enrichment-prompt';
import type { Company, CompanyEnrichment, EnrichmentClaim, CitationChip } from './types';
import type { LlmConfigT } from '@/lib/schemas/llm-request';

/** Minimum sources required to render full summary. Below this → summary blanked. */
const MIN_SOURCES_FOR_SUMMARY = 2;
/** Per-cons-item citation floor. Items below this dropped. */
const MIN_CITATIONS_PER_CON = 2;
const ENRICHMENT_TTL_DAYS = 30;

export interface EnrichCompanyCtx {
  llm: LlmConfigT & { apiKey: string };
  signal?: AbortSignal;
}

export interface EnrichCompanySuccess {
  ok: true;
  enrichment: CompanyEnrichment;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
}

export interface EnrichCompanyFailure {
  ok: false;
  status: number;
  code: 'parse_failed' | 'invalid_shape' | 'provider_error' | 'empty_response';
  message: string;
  rawHead?: string;
}

export type EnrichCompanyResult = EnrichCompanySuccess | EnrichCompanyFailure;

/**
 * Run grounded-search enrichment + parse + apply insufficient-source guard.
 * Always returns a CompanyEnrichment object (possibly with empty arrays +
 * insufficientSources flag) on success — caller writes to KV verbatim.
 */
export async function enrichCompany(
  company: Company,
  ctx: EnrichCompanyCtx,
): Promise<EnrichCompanyResult> {
  let call;
  try {
    call = await callLLM({
      config: ctx.llm,
      system: ENRICHMENT_SYSTEM,
      user: buildEnrichmentUserPrompt(company),
      expectJson: true,
      enableGrounding: true,
      maxOutputTokens: 4096,
      // Thinking ON — enrichment is open-ended reasoning, benefits from it.
      ...(ctx.signal ? { signal: ctx.signal } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 502,
      code: 'provider_error',
      message: `Lỗi LLM khi enrich Company: ${msg.slice(0, 200)}`,
    };
  }

  if (!call.text) {
    return {
      ok: false,
      status: 502,
      code: 'empty_response',
      message: 'Gemini trả về phản hồi rỗng cho enrichment.',
    };
  }

  const parsed = parseEnrichmentResponse(call.text);
  if (!parsed.ok) return parsed;

  const enrichment = applyInsufficientSourceGuard(parsed.data);
  return {
    ok: true,
    enrichment,
    promptTokens: call.promptTokens,
    completionTokens: call.completionTokens,
  };
}

/**
 * Pure parser exposed for unit tests. Returns discriminated union — never
 * throws.
 */
export function parseEnrichmentResponse(
  raw: string,
):
  | { ok: true; data: EnrichmentResponse }
  | { ok: false; status: number; code: 'parse_failed' | 'invalid_shape'; message: string; rawHead?: string } {
  const parsed = safeParseJson<unknown>(raw);
  if (!parsed) {
    return {
      ok: false,
      status: 502,
      code: 'parse_failed',
      message: 'Gemini trả về JSON không hợp lệ.',
      ...(raw.length > 0 ? { rawHead: raw.slice(0, 200) } : {}),
    };
  }
  const validated = EnrichmentResponseSchema.safeParse(parsed);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    return {
      ok: false,
      status: 502,
      code: 'invalid_shape',
      message: `Schema sai: ${issue ? `${issue.path.join('.')} — ${issue.message}` : 'unknown'}`,
    };
  }
  return { ok: true, data: validated.data };
}

/**
 * Defamation guard. Applied after schema parse, before KV write.
 *   - cons items with <MIN_CITATIONS_PER_CON citations → dropped
 *   - if global sourceCount < MIN_SOURCES_FOR_SUMMARY → summary blanked + insufficientSources flag
 *
 * Pure. Exposed for unit tests.
 */
export function applyInsufficientSourceGuard(parsed: EnrichmentResponse): CompanyEnrichment {
  const filteredCons: EnrichmentClaim[] = parsed.cons
    .filter((c) => c.citations.length >= MIN_CITATIONS_PER_CON)
    .map(toEnrichmentClaim);

  const pros: EnrichmentClaim[] = parsed.pros.map(toEnrichmentClaim);

  const insufficientGlobalSources = parsed.sourceCount < MIN_SOURCES_FOR_SUMMARY;
  const summary = insufficientGlobalSources ? '' : parsed.summary;

  return {
    summary,
    pros,
    cons: filteredCons,
    ...(insufficientGlobalSources ? { insufficientSources: true } : {}),
    enrichedAt: new Date().toISOString(),
  };
}

function toEnrichmentClaim(raw: z.infer<typeof EnrichmentResponseSchema>['pros'][number]): EnrichmentClaim {
  return {
    text: raw.text,
    citations: raw.citations.map(
      (c): CitationChip => ({
        url: c.url,
        label: c.title || safeHostname(c.url),
      }),
    ),
  };
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

/** Check whether existing enrichment is past 30d expiry. */
export function isEnrichmentStale(enrichment: CompanyEnrichment | undefined): boolean {
  if (!enrichment) return true;
  const t = Date.parse(enrichment.enrichedAt);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > ENRICHMENT_TTL_DAYS * 24 * 60 * 60 * 1000;
}
