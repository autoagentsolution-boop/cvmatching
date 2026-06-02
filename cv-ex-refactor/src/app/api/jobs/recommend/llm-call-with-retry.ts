// LLM call helper for the recommend route.
// Attempts the call with maxOutputTokens=10000; on JSON-parse failure retries once at 12000.
// Returns { raw, promptTokens, completionTokens } or throws on hard LLM error.

import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import type { RecommendLlmConfig } from '@/lib/schemas/job-recommend-request';

export interface LlmCallResult {
  raw: string;
  parsedRaw: unknown;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
}

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
    maxOutputTokens: 10000,
    ...(signal ? { signal } : {}),
  });

  let raw = first.text;
  let promptTokens = first.promptTokens;
  let completionTokens = first.completionTokens;
  let parsedRaw = safeParseJson(raw);

  if (!parsedRaw && !signal?.aborted) {
    // One retry with a larger token cap in case output was truncated.
    // Skip retry if the deadline already fired — saves the budget for the catch path.
    try {
      const retry = await callLLM({
        config: { ...llmConfig, apiKey },
        system,
        user,
        expectJson: true,
        maxOutputTokens: 12000,
        ...(signal ? { signal } : {}),
      });
      raw = retry.text;
      promptTokens = (promptTokens ?? 0) + (retry.promptTokens ?? 0);
      completionTokens = (completionTokens ?? 0) + (retry.completionTokens ?? 0);
      parsedRaw = safeParseJson(raw);
    } catch {
      // Retry failed — parsedRaw stays null; caller handles it.
    }
  }

  return { raw, parsedRaw, promptTokens, completionTokens };
}
