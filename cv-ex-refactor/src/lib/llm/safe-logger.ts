import { trackUsage, type UsageAction, type AnalyzeVariant } from '@/lib/usage/track-usage';

export interface LlmCallMeta {
  endpoint: UsageAction;
  provider: string;
  model: string;
  byok: boolean;
  status: 'ok' | 'error';
  latencyMs: number;
  inputChars?: number | undefined;
  outputChars?: number | undefined;
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
  error?: string | undefined;
  /** Present iff signed-in (shared-key path or signed-in BYOK). */
  userId?: string | undefined;
  /** Only meaningful when endpoint === 'analyze' — v2 = JD Matching, v3 = CV-Solo. */
  variant?: AnalyzeVariant | undefined;
}

/**
 * Emit a structured log line for ops + best-effort usage tracking to KV.
 * Awaits the KV write (~20ms) so it completes before the serverless function
 * is suspended. Failures are swallowed so an LLM response is never blocked.
 */
export async function logLlmCall(meta: LlmCallMeta): Promise<void> {
  const { userId: _userId, ...logSafe } = meta;
  console.log(JSON.stringify({ event: 'llm_call', ...logSafe }));

  try {
    await trackUsage({
      action: meta.endpoint,
      status: meta.status,
      byok: meta.byok,
      userId: meta.userId,
      variant: meta.variant,
      model: meta.model,
      inputChars: meta.inputChars,
      outputChars: meta.outputChars,
      promptTokens: meta.promptTokens,
      completionTokens: meta.completionTokens,
    });
  } catch (e) {
    console.warn('[safe-logger] track_usage_failed', {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
