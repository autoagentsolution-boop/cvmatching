import type { LlmConfigT } from '@/lib/schemas/llm-request';
import { callGemini, type LlmCallResult } from './call-gemini';
import { callOpenAI } from './call-openai';

const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';

export interface CallLlmOpts {
  config: LlmConfigT & { apiKey: string };
  system: string;
  user: string;
  expectJson: boolean;
  /** Override per-call output cap. Defaults to provider built-in. */
  maxOutputTokens?: number;
  /** External abort signal — caller-controlled deadline. */
  signal?: AbortSignal;
  /**
   * Gemini-only: skip the 2.5-series thinking phase. No-op for other providers.
   * Set true for structured-JSON tasks (scoring, extraction, rewriting).
   */
  disableThinking?: boolean;
  /**
   * Gemini-only: enable Google Search grounding (tools: [{ googleSearch: {} }]).
   * When set, response includes `citations` array from groundingMetadata.
   * No-op for OpenAI-compatible providers.
   */
  enableGrounding?: boolean;
}

export type { LlmCallResult };

export async function callLLM({
  config,
  system,
  user,
  expectJson,
  maxOutputTokens,
  signal,
  disableThinking,
  enableGrounding,
}: CallLlmOpts): Promise<LlmCallResult> {
  if (config.provider === 'gemini') {
    return callGemini({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      system,
      user,
      expectJson,
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      ...(signal ? { signal } : {}),
      ...(disableThinking ? { disableThinking: true } : {}),
      ...(enableGrounding ? { enableGrounding: true } : {}),
    });
  }

  const baseUrl =
    config.provider === 'openai' ? OPENAI_DEFAULT_BASE : (config.baseUrl ?? '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('Provider tuỳ chỉnh cần baseUrl');

  return callOpenAI({
    apiKey: config.apiKey,
    baseUrl,
    model: config.model,
    temperature: config.temperature,
    system,
    user,
    expectJson,
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
    ...(signal ? { signal } : {}),
  });
}
