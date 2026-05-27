import type {
  AnalyzeRequest,
  AnalyzeRequestLLM,
  AnalysisResult,
  GenerateCvRequest,
  Language,
} from './types';

interface ErrorBody {
  code: string;
  message: string;
}

async function parseErrorBody(res: Response): Promise<ErrorBody> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string } | string;
    };
    if (typeof body.error === 'string') {
      return { code: 'unknown', message: body.error };
    }
    if (typeof body.error === 'object' && body.error) {
      return {
        code: body.error.code ?? 'unknown',
        message: body.error.message ?? `HTTP ${res.status}`,
      };
    }
  } catch {
    // non-JSON body — fall through
  }
  return { code: 'unknown', message: `HTTP ${res.status}` };
}

/**
 * Translate raw LLM-provider error messages into user-friendly Vietnamese.
 * Server-side codes (quota_exceeded, unauthorized, etc.) already carry
 * user-friendly text — only `llm_provider_error` reaches the LLM and needs
 * humanizing.
 */
function humanizeLlmError(raw: string): string {
  const m = raw.toLowerCase();
  const mentionsGemini = m.includes('gemini');
  const mentionsOpenAi = m.includes('openai');
  const provider = mentionsGemini ? 'Gemini' : mentionsOpenAi ? 'OpenAI' : 'AI';

  if (m.includes('timeout') || m.includes('abort') || m.includes('etimedout') || m.includes('timed out')) {
    return `${provider} mất quá nhiều thời gian phản hồi — có thể đang quá tải. Vui lòng thử lại sau 1–2 phút.`;
  }
  if (m.includes('fetch failed') || m.includes('network') || m.includes('econnreset')) {
    return `Không kết nối được đến ${provider}. Kiểm tra mạng hoặc thử lại.`;
  }
  if (/\b40[13]\b/.test(raw) || m.includes('unauthorized') || m.includes('forbidden') || m.includes('invalid api key') || m.includes('api_key')) {
    return `API key ${provider} không hợp lệ hoặc đã bị thu hồi. Vui lòng kiểm tra trong Settings.`;
  }
  if (/\b429\b/.test(raw) || m.includes('rate limit') || m.includes('quota') || m.includes('exceeded') || m.includes('resource_exhausted')) {
    return `Đã vượt giới hạn của ${provider}. Đợi vài phút rồi thử lại, hoặc đổi sang model khác trong Settings.`;
  }
  if (/\b5\d\d\b/.test(raw) || m.includes('overload') || m.includes('unavailable')) {
    return `${provider} đang quá tải. Thử lại sau 1–2 phút hoặc đổi sang model khác trong Settings.`;
  }
  if (m.includes('json bị cắt') || m.includes('truncate')) {
    return `Kết quả ${provider} bị cắt do quá tải. Vui lòng thử lại.`;
  }
  if (m.includes('json không hợp lệ') || m.includes('json_parse') || m.includes('invalid json')) {
    return `${provider} trả về kết quả không đọc được. Thử lại hoặc đổi model.`;
  }
  if (m.includes('rỗng') || m.includes('empty')) {
    return `${provider} trả về kết quả rỗng. Thử lại — nếu lặp lại, đổi model.`;
  }
  if (m.includes('not found') || m.includes('does not exist') || m.includes('model')) {
    if (m.includes('model')) {
      return `Model "${extractModelName(raw)}" không tồn tại hoặc không khả dụng với ${provider}. Kiểm tra tên model trong Settings.`;
    }
  }
  return `${provider} gặp sự cố. Thử lại hoặc đổi model trong Settings.`;
}

function extractModelName(raw: string): string {
  const m = raw.match(/model[s]?\s+['"`]?([\w.\-/:]+)/i);
  return m?.[1] ?? '...';
}

function buildErrorMessage(body: ErrorBody, fallbackPrefix: string): string {
  // Server-validated user-friendly codes pass through as-is.
  if (body.code === 'invalid_input' || body.code === 'quota_exceeded' ||
      body.code === 'unauthorized' || body.code === 'shared_key_disabled' ||
      body.code === 'rate_limited' || body.code === 'file_too_large' ||
      body.code === 'unsupported_format' || body.code === 'parse_failed' ||
      body.code === 'scrape_failed' || body.code === 'network_failed') {
    return body.message;
  }
  // LLM-provider errors need humanizing.
  if (body.code === 'llm_provider_error') {
    return humanizeLlmError(body.message);
  }
  // Unknown — generic with prefix for context.
  return `${fallbackPrefix}: ${body.message}`;
}

/**
 * POST /api/analyze — returns AnalysisResult.
 * Returns 404 until Phase 06 ships; callers should handle the thrown Error
 * and display it via ErrorState.
 */
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// BYOK key never travels in fetch bodies or custom headers — the user
// registers it once via /api/keys/store, the server vault assigns a token,
// and that token rides along automatically in the httpOnly cookie.
export async function callAnalyze(payload: AnalyzeRequest): Promise<AnalysisResult> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Phân tích thất bại'));
  }
  return res.json() as Promise<AnalysisResult>;
}

/**
 * POST /api/generate-cv — returns refined CV as Markdown string.
 * Mirrors generateMatchedCV() in cv_fit_scoring_app.html (tone/length/extraInstructions fields).
 * Returns 404 until Phase 06 ships.
 */
export async function callGenerateCv(payload: GenerateCvRequest): Promise<string> {
  const res = await fetch('/api/generate-cv', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Tạo CV thất bại'));
  }
  const data = (await res.json()) as { markdown: string };
  return data.markdown;
}

/**
 * POST /api/extract-must-haves — returns hard-gate requirements parsed from JD.
 * Only the 404 path falls back to a deterministic heuristic (endpoint not deployed yet).
 * All other failures including 401 surface to the caller so the user sees real errors,
 * not silently-degraded heuristic output.
 */
export async function callExtractMustHaves(
  jdText: string,
  llm: AnalyzeRequestLLM,
  language: Language,
): Promise<string[]> {
  const res = await fetch('/api/extract-must-haves', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ jdText, llm, language }),
    credentials: 'same-origin',
  });
  if (res.ok) {
    const data = (await res.json()) as { mustHaves: string[] };
    return data.mustHaves;
  }
  if (res.status === 404) {
    return heuristicMustHaves(jdText);
  }
  throw new Error(buildErrorMessage(await parseErrorBody(res), 'Trích yêu cầu bắt buộc thất bại'));
}

/**
 * Phase 1 fallback — picks short lines that look like requirement bullets.
 * Replaced by LLM extraction in Phase 06.
 */
function heuristicMustHaves(jdText: string): string[] {
  const lines = jdText
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*·]\s*/, ''))
    .filter((l) => l.length > 0 && l.length <= 140);
  const requireRe = /(required|must have|must-have|minimum|at least|years|proficien|expert|fluent)/i;
  const picked = lines.filter((l) => requireRe.test(l));
  const seen = new Set<string>();
  const dedup: string[] = [];
  for (const item of picked.length > 0 ? picked : lines) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(item);
    if (dedup.length >= 6) break;
  }
  return dedup;
}

/**
 * POST /api/scrape — returns scraped JD text from a URL.
 * Returns 404 until Phase 05 ships.
 */
// ---- BYOK vault client helpers ---------------------------------------------

export interface ByokStatus {
  hasKey: boolean;
  tail: string | null;
}

export async function fetchByokStatus(): Promise<ByokStatus> {
  const res = await fetch('/api/keys/status', { credentials: 'same-origin' });
  if (!res.ok) return { hasKey: false, tail: null };
  return res.json() as Promise<ByokStatus>;
}

export async function storeByokKey(apiKey: string): Promise<{ tail: string }> {
  const res = await fetch('/api/keys/store', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ apiKey }),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Lưu API key thất bại'));
  }
  return res.json() as Promise<{ tail: string }>;
}

export async function clearByokKey(): Promise<void> {
  await fetch('/api/keys/clear', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

export async function callScrapeJd(url: string): Promise<string> {
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Lấy nội dung JD thất bại'));
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}
