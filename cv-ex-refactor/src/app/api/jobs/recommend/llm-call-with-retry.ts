// LLM call helper for the recommend route.
//
// 2026-06-10: added retry-then-fallback layer (callLLMWithFallback) so
// transient Gemini 503 ("high demand") on the primary model doesn't
// bubble straight to a user-visible 503. Behaviour:
//   1. Try the configured model once.
//   2. On 429 / 503 / overload → retry the SAME model after 600ms.
//   3. Still failing → fall through Gemini sibling models in the
//      Gemini-only chain (skips when user is on OpenAI/custom).
// Total time budget stays under our 55s internal deadline because
// backoff is short and each fallback gets one shot only.

import { callLLMWithFallback, geminiFallbackChain } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import type { RecommendLlmConfig } from '@/lib/schemas/job-recommend-request';

export interface LlmCallResult {
  raw: string;
  parsedRaw: unknown;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
  /** finishReason — MAX_TOKENS, STOP, SAFETY, etc. */
  finishReason: string | undefined;
  /** 1 = first try succeeded; ≥2 = retried or fell back. */
  attempts: number;
  /** Model that actually produced the response (after fallback). */
  actualModel: string;
}

const MAX_OUTPUT_TOKENS = 24_000;

export async function callRecommendLlm(
  llmConfig: RecommendLlmConfig,
  apiKey: string,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<LlmCallResult> {
  const fallbackModels =
    llmConfig.provider === 'gemini' ? geminiFallbackChain(llmConfig.model) : [];

  const res = await callLLMWithFallback({
    config: { ...llmConfig, apiKey },
    system,
    user,
    expectJson: true,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    // Recommend is structured scoring — Gemini's thinking phase adds 30-50s
    // for zero quality gain. Disable.
    disableThinking: true,
    fallbackModels,
    retries: 1,
    ...(signal ? { signal } : {}),
  });

  const parsedRaw = safeParseJson(res.text);

  return {
    raw: res.text,
    parsedRaw,
    promptTokens: res.promptTokens,
    completionTokens: res.completionTokens,
    finishReason: res.finishReason,
    attempts: res.usedFallback ? 2 : 1,
    actualModel: res.actualModel,
  };
}
