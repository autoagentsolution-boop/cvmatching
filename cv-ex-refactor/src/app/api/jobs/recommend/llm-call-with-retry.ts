// LLM call helper for the recommend route.
//
// 2026-06-03: simplified to single-attempt after Wave A pushed output volume up
// and the retry path was burning the 60s Vercel budget. With 6 candidates × ~600
// tokens = ~4K output, 24K is plenty headroom; MAX_TOKENS shouldn't fire. On
// parse failure we surface a structured error instead of doubling latency.
//
// Retained the `attempts` field on the result so the route's logging + error
// messages stay shape-compatible — value is always 1 now.

import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import type { RecommendLlmConfig } from '@/lib/schemas/job-recommend-request';

export interface LlmCallResult {
  raw: string;
  parsedRaw: unknown;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
  /** finishReason — MAX_TOKENS, STOP, SAFETY, etc. */
  finishReason: string | undefined;
  /** Always 1 (retry path removed); kept for log shape compatibility. */
  attempts: number;
}

const MAX_OUTPUT_TOKENS = 24_000;

export async function callRecommendLlm(
  llmConfig: RecommendLlmConfig,
  apiKey: string,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<LlmCallResult> {
  const res = await callLLM({
    config: { ...llmConfig, apiKey },
    system,
    user,
    expectJson: true,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    // Recommend is structured scoring — Gemini's thinking phase adds 30-50s
    // for zero quality gain. Disable.
    disableThinking: true,
    ...(signal ? { signal } : {}),
  });

  const parsedRaw = safeParseJson(res.text);

  return {
    raw: res.text,
    parsedRaw,
    promptTokens: res.promptTokens,
    completionTokens: res.completionTokens,
    finishReason: res.finishReason,
    attempts: 1,
  };
}
