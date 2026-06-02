export interface GeminiCallOpts {
  apiKey: string;
  model: string;
  temperature: number;
  system: string;
  user: string;
  expectJson: boolean;
  /** Per-call cap; falls back to 16384 (covers analyze JSON ~8-15K chars). */
  maxOutputTokens?: number;
  /** External abort signal — caller-controlled deadline. */
  signal?: AbortSignal;
}

export interface LlmCallResult {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
}

export async function callGemini(opts: GeminiCallOpts): Promise<LlmCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.model,
  )}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      generationConfig: {
        temperature: opts.temperature,
        // Default 16K covers analyze (~8-15K chars). Callers with bigger
        // schemas (e.g. career-path roadmap) override via maxOutputTokens
        // to avoid silent truncation.
        maxOutputTokens: opts.maxOutputTokens ?? 16384,
        ...(opts.expectJson ? { responseMimeType: 'application/json' } : {}),
      },
    }),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Gemini ${res.status}: ${detail}`);
  }

  const json: unknown = await res.json();
  const text = extractGeminiText(json);
  if (!text) throw new Error('Gemini trả về phản hồi rỗng');
  const usage = extractGeminiUsage(json);
  return { text, ...usage };
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const first = candidates[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined;
  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

function extractGeminiUsage(payload: unknown): { promptTokens?: number; completionTokens?: number } {
  if (!payload || typeof payload !== 'object') return {};
  const meta = (payload as { usageMetadata?: unknown }).usageMetadata;
  if (!meta || typeof meta !== 'object') return {};
  const m = meta as { promptTokenCount?: unknown; candidatesTokenCount?: unknown };
  const out: { promptTokens?: number; completionTokens?: number } = {};
  if (typeof m.promptTokenCount === 'number') out.promptTokens = m.promptTokenCount;
  if (typeof m.candidatesTokenCount === 'number') out.completionTokens = m.candidatesTokenCount;
  return out;
}
