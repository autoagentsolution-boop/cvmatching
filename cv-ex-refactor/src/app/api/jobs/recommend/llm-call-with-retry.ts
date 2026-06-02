// LLM call helper for the recommend route.
// First attempt uses maxOutputTokens=16K. On JSON-parse failure OR MAX_TOKENS finishReason,
// retries once at 24K (Gemini 2.5 Flash supports up to 65K output). Returns the parsed
// result + raw + finish reason so the route can surface a specific error to the user.

import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import type { RecommendLlmConfig } from '@/lib/schemas/job-recommend-request';

export interface LlmCallResult {
  raw: string;
  parsedRaw: unknown;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
  /** Last attempt's finishReason — MAX_TOKENS, STOP, SAFETY, etc. */
  finishReason: string | undefined;
  attempts: number;
}

const FIRST_ATTEMPT_TOKENS = 16_000;
const RETRY_ATTEMPT_TOKENS = 24_000;

export async function callRecommendLlm(
  llmConfig: RecommendLlmConfig,
  apiKey: string,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<LlmCallResult> {
  const first = await callLLM({
    config: { ...llmConfig, apiKey },
    system,
    user,
    expectJson: true,
    maxOutputTokens: FIRST_ATTEMPT_TOKENS,
    ...(signal ? { signal } : {}),
  });

  let raw = first.text;
  let promptTokens = first.promptTokens;
  let completionTokens = first.completionTokens;
  let finishReason = first.finishReason;
  let parsedRaw = safeParseJson(raw);
  let attempts = 1;

  const needsRetry = !parsedRaw || finishReason === 'MAX_TOKENS';
  if (needsRetry && !signal?.aborted) {
    try {
      const retry = await callLLM({
        config: { ...llmConfig, apiKey },
        system,
        user,
        expectJson: true,
        maxOutputTokens: RETRY_ATTEMPT_TOKENS,
        ...(signal ? { signal } : {}),
      });
      attempts = 2;
      raw = retry.text;
      promptTokens = (promptTokens ?? 0) + (retry.promptTokens ?? 0);
      completionTokens = (completionTokens ?? 0) + (retry.completionTokens ?? 0);
      finishReason = retry.finishReason;
      parsedRaw = safeParseJson(raw);
    } catch {
      // Retry failed — parsedRaw stays null; caller handles it.
    }
  }

  return { raw, parsedRaw, promptTokens, completionTokens, finishReason, attempts };
}
