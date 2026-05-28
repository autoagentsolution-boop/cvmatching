import { NextRequest, NextResponse } from 'next/server';
import { SuggestPathsBody } from '@/lib/schemas/llm-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { buildSuggestPathsPrompts } from '@/lib/llm/prompt-suggest-paths';
import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import { normalizeSuggestPaths } from '@/lib/llm/normalize-suggest-paths';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { enforceIpRateLimit, rateLimitedResponse } from '@/lib/quota/enforce-ip-rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  // Suggest is a cheap helper called automatically on page load. Skip the
  // daily quota bucket (matches extract-must-haves pattern) but enforce an
  // IP rate limit so it can't be spammed.
  const rate = await enforceIpRateLimit(req, {
    endpoint: '/api/career-path/suggest',
    max: 10,
    windowSec: 60,
  });
  if (!rate.ok) return rateLimitedResponse(rate.retryAfterSec);

  const json = await req.json().catch(() => null);
  const parsed = SuggestPathsBody.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    const msg = issue?.message ?? 'Body không hợp lệ.';
    return err('invalid_input', path ? `${path}: ${msg}` : msg, 400);
  }

  const body = parsed.data;
  const byokToken = req.cookies.get('byok-token')?.value;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown';
  const resolved = await resolveApiKey(body.llm, 'career-path-suggest', { byokToken, ip });
  if (!resolved.ok) {
    return err(resolved.code, resolved.message, resolved.status);
  }

  const { system, user } = buildSuggestPathsPrompts(body);
  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    // Small output (3-5 cards, ~1-2K chars). 4K Gemini / 2K OpenAI is plenty
    // and keeps cost low for the auto-call on page load.
    const { text: raw, promptTokens, completionTokens } = await callLLM({
      config: { ...body.llm, apiKey: resolved.apiKey },
      system,
      user,
      expectJson: true,
      maxOutputTokens: body.llm.provider === 'gemini' ? 4096 : 2048,
    });

    const parsedRaw = safeParseJson(raw);
    if (!parsedRaw) {
      await logLlmCall({
        endpoint: 'career-path-suggest',
        provider: body.llm.provider,
        model: body.llm.model,
        byok: resolved.byok,
        userId: resolved.userId,
        status: 'error',
        latencyMs: Date.now() - start,
        inputChars,
        outputChars: raw.length,
        promptTokens,
        completionTokens,
        error: 'json_parse_failed',
      });
      return err('llm_provider_error', 'AI trả về kết quả không đọc được. Thử lại hoặc đổi model.', 502);
    }

    const suggestions = normalizeSuggestPaths(parsedRaw);
    if (suggestions.length === 0) {
      await logLlmCall({
        endpoint: 'career-path-suggest',
        provider: body.llm.provider,
        model: body.llm.model,
        byok: resolved.byok,
        userId: resolved.userId,
        status: 'error',
        latencyMs: Date.now() - start,
        inputChars,
        outputChars: raw.length,
        promptTokens,
        completionTokens,
        error: 'no_suggestions',
      });
      return err('llm_provider_error', 'AI không đề xuất được hướng phát triển. Thử lại.', 502);
    }

    await logLlmCall({
      endpoint: 'career-path-suggest',
      provider: body.llm.provider,
      model: body.llm.model,
      byok: resolved.byok,
      userId: resolved.userId,
      status: 'ok',
      latencyMs: Date.now() - start,
      inputChars,
      outputChars: raw.length,
      promptTokens,
      completionTokens,
    });

    return NextResponse.json({ suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'career-path-suggest',
      provider: body.llm.provider,
      model: body.llm.model,
      byok: resolved.byok,
      userId: resolved.userId,
      status: 'error',
      latencyMs: Date.now() - start,
      inputChars,
      error: message.slice(0, 200),
    });
    return err('llm_provider_error', `LLM lỗi: ${message.slice(0, 200)}`, 502);
  }
}
