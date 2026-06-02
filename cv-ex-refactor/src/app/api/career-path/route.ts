import { NextRequest, NextResponse } from 'next/server';
import { CareerPathBody } from '@/lib/schemas/llm-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { buildCareerPathPrompts } from '@/lib/llm/prompt-career-path';
import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import { normalizeCareerPath } from '@/lib/llm/normalize-career-path';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { checkKillSwitch } from '@/lib/cost/guard';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = CareerPathBody.safeParse(json);
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
  const resolved = await resolveApiKey(body.llm, 'career-path', { byokToken, ip });
  if (!resolved.ok) {
    return err(resolved.code, resolved.message, resolved.status);
  }

  if (!resolved.byok) {
    const killCheck = await checkKillSwitch('career-path');
    if (!killCheck.ok) {
      return err(
        'service_unavailable',
        'Tính năng Career Path tạm thời bị tắt do vượt ngưỡng chi phí. Vui lòng dùng API key riêng (Settings → BYOK) hoặc thử lại sau.',
        503,
      );
    }
  }

  const { system, user } = buildCareerPathPrompts(body);
  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    // Roadmap output is larger than analyze (multiple milestones × multiple
    // sub-lists + feasibility block). Bump default 16K → 24K Gemini tokens
    // and pin OpenAI completions to 8K so JSON does not get silently cut.
    const { text: raw, promptTokens, completionTokens } = await callLLM({
      config: { ...body.llm, apiKey: resolved.apiKey },
      system,
      user,
      expectJson: true,
      maxOutputTokens: body.llm.provider === 'gemini' ? 24576 : 8192,
    });

    const parsedRaw = safeParseJson(raw);
    if (!parsedRaw) {
      console.warn('[api/career-path] json_parse_failed', {
        provider: body.llm.provider,
        model: body.llm.model,
        outputChars: raw.length,
        ...(env.LOG_LLM_DEBUG === '1'
          ? { rawHead: raw.slice(0, 400), rawTail: raw.slice(-200) }
          : {}),
      });
      await logLlmCall({
        endpoint: 'career-path',
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
      return err(
        'llm_provider_error',
        raw.length < 2000
          ? 'LLM trả về JSON bị cắt (output quá ngắn). Vui lòng thử lại — model có thể đang quá tải.'
          : 'LLM trả về JSON không hợp lệ. Thử lại hoặc đổi model.',
        502,
      );
    }

    const result = normalizeCareerPath(parsedRaw);

    // Genuinely empty payload (no milestones AND no feasibility advice) is
    // a true LLM failure — surface it. If feasibility flagged unrealistic
    // with reasons + gentleAdvice, that IS a valid response even with few
    // milestones; let the UI render the banner.
    const hasMeaningfulPayload =
      result.milestones.length > 0 ||
      result.feasibility.reasons.length > 0 ||
      result.feasibility.gentleAdvice.length > 0;
    if (!hasMeaningfulPayload) {
      await logLlmCall({
        endpoint: 'career-path',
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
        error: 'empty_payload',
      });
      return err(
        'llm_provider_error',
        'LLM trả về kết quả rỗng. Vui lòng thử lại hoặc bổ sung mô tả mong muốn rõ hơn.',
        502,
      );
    }

    await logLlmCall({
      endpoint: 'career-path',
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

    return NextResponse.json({
      ...result,
      quotaRemaining: resolved.quotaRemaining,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'career-path',
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
