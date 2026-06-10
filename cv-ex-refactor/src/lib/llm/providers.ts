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

/**
 * 2026-06-10: Gemini upstream returns 503 UNAVAILABLE ("high demand")
 * intermittently — especially on `gemini-flash-latest` during business
 * hours. Wrap callLLM with a retry-then-fallback chain so transient
 * upstream issues don't surface to users.
 *
 * Behaviour per call:
 *   1. Try config.model — on transient error (429 / 503 / overload),
 *      retry once after a short backoff.
 *   2. If still failing, walk through `fallbackModels` (in order). Each
 *      gets one attempt — total budget capped so we don't blow past
 *      Vercel's function deadline.
 *   3. Non-transient errors (4xx auth, prompt-shape) bubble immediately.
 *
 * Picks-up the same signal so the caller's deadline still wins.
 */
export interface CallLlmWithFallbackOpts extends CallLlmOpts {
  /** Tried in order after config.model fails twice. */
  fallbackModels?: string[];
  /** Extra retries on the FIRST model only. Default 1 = total 2 attempts. */
  retries?: number;
}

function isTransientLlmError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /(?:^|\s)(?:429|50[023])\b|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|overload|rate.?limit|INTERNAL/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callLLMWithFallback(opts: CallLlmWithFallbackOpts): Promise<LlmCallResult & { actualModel: string; usedFallback: boolean }> {
  const { fallbackModels = [], retries = 1, ...base } = opts;
  const chain = [opts.config.model, ...fallbackModels];
  let lastError: unknown = new Error('LLM fallback chain empty');

  for (let mi = 0; mi < chain.length; mi++) {
    const model = chain[mi]!;
    const isFirst = mi === 0;
    const attemptCount = isFirst ? retries + 1 : 1; // retry only on the primary model
    for (let a = 0; a < attemptCount; a++) {
      try {
        const res = await callLLM({
          ...base,
          config: { ...base.config, model },
        });
        return { ...res, actualModel: model, usedFallback: mi > 0 };
      } catch (e) {
        lastError = e;
        const transient = isTransientLlmError(e);
        if (!transient) throw e;

        const lastInChain = mi === chain.length - 1;
        const lastRetryOnModel = a === attemptCount - 1;
        if (lastRetryOnModel && lastInChain) throw e;

        if (lastRetryOnModel) {
          // Move to next model in fallback chain.
          console.warn('[llm-fallback] model switch', {
            from: model,
            to: chain[mi + 1],
            reason: e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120),
          });
          break;
        }

        // Same model retry — short backoff to ride out transient spikes.
        const backoffMs = 600 * (a + 1);
        console.warn('[llm-fallback] retry same model', {
          model,
          attempt: a + 1,
          of: attemptCount,
          backoffMs,
        });
        await sleep(backoffMs);
      }
    }
  }
  throw lastError;
}

/**
 * Default Gemini fallback chain — when the caller's model is in the
 * Gemini family, fall back to siblings that historically have separate
 * quota buckets / are less throttled. Per-model 200/503 status varies
 * day-by-day; the order below is the empirical best-availability order
 * verified 2026-06-10.
 */
export function geminiFallbackChain(currentModel: string): string[] {
  // Avoid using the SAME model as a fallback (no-op).
  const all = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-pro'];
  return all.filter((m) => m !== currentModel);
}
