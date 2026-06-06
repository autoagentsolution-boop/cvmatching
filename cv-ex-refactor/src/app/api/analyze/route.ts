import { NextRequest, NextResponse } from 'next/server';
import { AnalyzeBody, AnalyzeV3Body } from '@/lib/schemas/llm-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { buildAnalyzePrompts } from '@/lib/llm/prompt-analyze';
import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import { normalizeAnalysis } from '@/lib/llm/normalize-analysis';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { checkKillSwitch, recordCost } from '@/lib/cost/guard';
import { microUsdCost } from '@/lib/llm/model-prices';
import { handleAnalyzeV3 } from '@/lib/analyze/handle-v3';
import { isV3Shape } from '@/lib/analyze/dispatch';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);

  const byokToken = req.cookies.get('byok-token')?.value;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown';

  // v0.4 dispatcher: route by body shape. v3 (CV-solo) coexists with v2
  // (CV-vs-JD) during the pivot; Phase 7 removes v2.
  if (isV3Shape(json)) {
    const parsed = AnalyzeV3Body.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.join('.') ?? '';
      const msg = issue?.message ?? 'Body không hợp lệ.';
      return err('invalid_input', path ? `${path}: ${msg}` : msg, 400);
    }
    return handleAnalyzeV3(parsed.data, { ...(byokToken ? { byokToken } : {}), ip });
  }

  const parsed = AnalyzeBody.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    const msg = issue?.message ?? 'Body không hợp lệ.';
    return err('invalid_input', path ? `${path}: ${msg}` : msg, 400);
  }

  const body = parsed.data;
  const resolved = await resolveApiKey(body.llm, 'analyze', { byokToken, ip });
  if (!resolved.ok) {
    return err(resolved.code, resolved.message, resolved.status);
  }

  // Cost kill-switch only applies to non-admin shared-key callers. BYOK users
  // bring their own billing, and admins need an always-on path to test the
  // platform regardless of the kill-switch state during pilot.
  if (!resolved.byok && !resolved.isAdmin) {
    const killCheck = await checkKillSwitch('analyze');
    if (!killCheck.ok) {
      return err(
        'service_unavailable',
        'Tính năng Analyze tạm thời bị tắt do vượt ngưỡng chi phí. Vui lòng dùng API key riêng (Settings → BYOK) hoặc thử lại sau.',
        503,
      );
    }
  }

  const { system, user } = buildAnalyzePrompts(body);
  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    const { text: raw, promptTokens, completionTokens } = await callLLM({
      config: { ...body.llm, apiKey: resolved.apiKey },
      system,
      user,
      expectJson: true,
    });

    const parsedRaw = safeParseJson(raw);
    if (!parsedRaw) {
      console.warn('[api/analyze] json_parse_failed', {
        provider: body.llm.provider,
        model: body.llm.model,
        outputChars: raw.length,
        ...(env.LOG_LLM_DEBUG === '1'
          ? { rawHead: raw.slice(0, 400), rawTail: raw.slice(-200) }
          : {}),
      });
      await logLlmCall({
        endpoint: 'analyze',
        variant: 'v2',
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
          ? 'LLM trả về JSON bị cắt (output quá ngắn). Vui lòng thử lại — Gemini đôi khi truncate khi đang quá tải.'
          : 'LLM trả về JSON không hợp lệ. Thử lại hoặc đổi model.',
        502,
      );
    }

    const result = normalizeAnalysis(parsedRaw);

    await logLlmCall({
      endpoint: 'analyze',
      variant: 'v2',
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

    if (!resolved.byok) {
      await recordCost('analyze', microUsdCost(body.llm.model, promptTokens ?? 0, completionTokens ?? 0));
    }

    return NextResponse.json({
      ...result,
      quotaRemaining: resolved.quotaRemaining,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'analyze',
      variant: 'v2',
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
