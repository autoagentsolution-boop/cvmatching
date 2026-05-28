import type { LlmCallResult } from './call-gemini';

export interface OpenAICallOpts {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  system: string;
  user: string;
  expectJson: boolean;
  /** Per-call cap on completion tokens. Omit to use provider default. */
  maxOutputTokens?: number;
}

export async function callOpenAI(opts: OpenAICallOpts): Promise<LlmCallResult> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      ...(opts.maxOutputTokens ? { max_tokens: opts.maxOutputTokens } : {}),
      ...(opts.expectJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`OpenAI ${res.status}: ${detail}`);
  }

  const json: unknown = await res.json();
  const text = extractOpenAiText(json);
  if (!text) throw new Error('OpenAI trả về phản hồi rỗng');
  const usage = extractOpenAiUsage(json);
  return { text, ...usage };
}

function extractOpenAiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const first = choices[0] as { message?: { content?: string } } | undefined;
  return (first?.message?.content ?? '').trim();
}

function extractOpenAiUsage(payload: unknown): { promptTokens?: number; completionTokens?: number } {
  if (!payload || typeof payload !== 'object') return {};
  const u = (payload as { usage?: unknown }).usage;
  if (!u || typeof u !== 'object') return {};
  const m = u as { prompt_tokens?: unknown; completion_tokens?: unknown };
  const out: { promptTokens?: number; completionTokens?: number } = {};
  if (typeof m.prompt_tokens === 'number') out.promptTokens = m.prompt_tokens;
  if (typeof m.completion_tokens === 'number') out.completionTokens = m.completion_tokens;
  return out;
}
