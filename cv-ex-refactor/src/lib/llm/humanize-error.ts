/**
 * Translate raw LLM-provider error messages into user-friendly Vietnamese.
 * Server-side codes (quota_exceeded, unauthorized, etc.) already carry
 * user-friendly text — only `llm_provider_error` reaches the LLM and needs
 * humanizing.
 *
 * Shared by every feature's api-client to keep messaging consistent.
 */

export interface ErrorBody {
  code: string;
  message: string;
}

const PASSTHROUGH_CODES = new Set([
  'invalid_input',
  'quota_exceeded',
  'unauthorized',
  'shared_key_disabled',
  'rate_limited',
  'file_too_large',
  'unsupported_format',
  'parse_failed',
  'scrape_failed',
  'network_failed',
  'llm_transient',
]);

/**
 * Transient LLM failure — model overload, rate limit, timeout, network.
 * Caller should retry in 1-2 min vs treating as a hard error.
 * Recognises BOTH raw provider strings ("Gemini 503", "RESOURCE_EXHAUSTED")
 * AND humanized output ("đang quá tải", "thử lại sau") so clients can
 * classify after the message has already been routed through humanize.
 */
export function isTransientLlmError(raw: string): boolean {
  const m = raw.toLowerCase();
  if (m.includes('timeout') || m.includes('abort') || m.includes('etimedout') || m.includes('timed out')) return true;
  if (m.includes('fetch failed') || m.includes('network') || m.includes('econnreset')) return true;
  if (/\b429\b/.test(raw) || m.includes('rate limit') || m.includes('quota') || m.includes('resource_exhausted')) return true;
  if (/\b5\d\d\b/.test(raw) || m.includes('overload') || m.includes('unavailable') || m.includes('high demand')) return true;
  if (m.includes('truncate') || m.includes('json bị cắt')) return true;
  // Humanized Vietnamese surfaces — match patterns emitted by humanizeLlmError.
  if (m.includes('đang quá tải') || m.includes('thử lại sau') || m.includes('đợi vài phút')) return true;
  if (m.includes('mất quá nhiều thời gian') || m.includes('không kết nối được')) return true;
  return false;
}

function extractModelName(raw: string): string {
  const m = raw.match(/model[s]?\s+['"`]?([\w.\-/:]+)/i);
  return m?.[1] ?? '...';
}

export function humanizeLlmError(raw: string): string {
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
  if (/\b5\d\d\b/.test(raw) || m.includes('overload') || m.includes('unavailable') || m.includes('high demand')) {
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

export function buildErrorMessage(body: ErrorBody, fallbackPrefix: string): string {
  if (PASSTHROUGH_CODES.has(body.code)) return body.message;
  if (body.code === 'llm_provider_error') return humanizeLlmError(body.message);
  return `${fallbackPrefix}: ${body.message}`;
}

export async function parseErrorBody(res: Response): Promise<ErrorBody> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string } | string;
    };
    if (typeof body.error === 'string') return { code: 'unknown', message: body.error };
    if (typeof body.error === 'object' && body.error) {
      return {
        code: body.error.code ?? 'unknown',
        message: body.error.message ?? `HTTP ${res.status}`,
      };
    }
  } catch {
    // non-JSON body
  }
  return { code: 'unknown', message: `HTTP ${res.status}` };
}
