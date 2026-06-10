/**
 * USD price per 1M tokens, by model id. Update when providers re-price.
 * Unknown models → returns null, callers treat as $0 (no metering).
 *
 * Sources (last refreshed 2026-05-27):
 *  - Google AI: ai.google.dev/pricing
 *  - OpenAI:    openai.com/api/pricing
 */
export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

const PRICES: Record<string, ModelPrice> = {
  // gemini-flash-latest is Google's alias for the current GA flash; priced
  // at the underlying 2.5-flash rate. gemini-2.0-flash is kept for legacy
  // cost-attribution lookups even though the model is deprecated (404).
  'gemini-flash-latest': { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  'gemini-2.0-flash': { inputPerMTok: 0.1, outputPerMTok: 0.4 },
  'gemini-2.0-flash-exp': { inputPerMTok: 0, outputPerMTok: 0 },
  'gemini-2.5-flash': { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  'gemini-2.5-pro': { inputPerMTok: 1.25, outputPerMTok: 10.0 },
  'gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  'gpt-4o': { inputPerMTok: 2.5, outputPerMTok: 10.0 },
};

export function priceFor(model: string): ModelPrice | null {
  return PRICES[model] ?? null;
}

/**
 * Cost in micro-USD (1 USD = 1_000_000 µUSD). Integer math, KV-friendly.
 * Returns 0 when model is unpriced or tokens are unknown.
 */
export function microUsdCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICES[model];
  if (!p) return 0;
  const inUsd = (p.inputPerMTok * promptTokens) / 1_000_000;
  const outUsd = (p.outputPerMTok * completionTokens) / 1_000_000;
  return Math.round((inUsd + outUsd) * 1_000_000);
}

export function microUsdToString(microUsd: number): string {
  const usd = microUsd / 1_000_000;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
