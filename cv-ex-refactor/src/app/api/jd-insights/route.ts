import { NextRequest, NextResponse } from 'next/server';
import { JdInsightsBody } from '@/lib/schemas/llm-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { buildJdInsightsPrompts } from '@/lib/llm/prompt-jd-insights';
import { normalizeJdInsights } from '@/lib/llm/normalize-jd-insights';
import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { checkKillSwitch, recordCost } from '@/lib/cost/guard';
import { microUsdCost } from '@/lib/llm/model-prices';

export const runtime = 'nodejs';
export const maxDuration = 30;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = JdInsightsBody.safeParse(json);
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
  const resolved = await resolveApiKey(body.llm, 'jd-insights', { byokToken, ip });
  if (!resolved.ok) return err(resolved.code, resolved.message, resolved.status);

  if (!resolved.byok && !resolved.isAdmin) {
    const killCheck = await checkKillSwitch('jd-insights');
    if (!killCheck.ok) {
      return err(
        'service_unavailable',
        'JD Insights tạm tắt do vượt ngưỡng chi phí. Vui lòng dùng API key riêng (Settings → BYOK) hoặc thử lại sau.',
        503,
      );
    }
  }

  const promptArgs: Parameters<typeof buildJdInsightsPrompts>[0] = {
    cvText: body.cvText,
    jdText: body.jdText,
    language: body.language,
  };
  if (body.analyzeSummary) promptArgs.analyzeSummary = body.analyzeSummary;
  const { system, user } = buildJdInsightsPrompts(promptArgs);
  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    const { text: raw, promptTokens, completionTokens } = await callLLM({
      config: { ...body.llm, apiKey: resolved.apiKey },
      system,
      user,
      expectJson: true,
    });

    const rawObj = safeParseJson<unknown>(raw);
    const insights = normalizeJdInsights(rawObj);

    if (!insights.insightsParagraph) {
      await logLlmCall({
        endpoint: 'jd-insights',
        provider: body.llm.provider,
        model: body.llm.model,
        byok: resolved.byok,
        ...(resolved.userId ? { userId: resolved.userId } : {}),
        status: 'error',
        latencyMs: Date.now() - start,
        inputChars,
        outputChars: raw.length,
        ...(promptTokens !== undefined ? { promptTokens } : {}),
        ...(completionTokens !== undefined ? { completionTokens } : {}),
        error: 'empty_insights',
      });
      return err('llm_provider_error', 'Không sinh được insights — thử lại.', 502);
    }

    await logLlmCall({
      endpoint: 'jd-insights',
      provider: body.llm.provider,
      model: body.llm.model,
      byok: resolved.byok,
      ...(resolved.userId ? { userId: resolved.userId } : {}),
      status: 'ok',
      latencyMs: Date.now() - start,
      inputChars,
      outputChars: raw.length,
      ...(promptTokens !== undefined ? { promptTokens } : {}),
      ...(completionTokens !== undefined ? { completionTokens } : {}),
    });

    if (!resolved.byok) {
      await recordCost('jd-insights', microUsdCost(body.llm.model, promptTokens ?? 0, completionTokens ?? 0));
    }

    return NextResponse.json({ ...insights, quotaRemaining: resolved.quotaRemaining });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'jd-insights',
      provider: body.llm.provider,
      model: body.llm.model,
      byok: resolved.byok,
      ...(resolved.userId ? { userId: resolved.userId } : {}),
      status: 'error',
      latencyMs: Date.now() - start,
      inputChars,
      error: message.slice(0, 200),
    });
    return err('llm_provider_error', `LLM lỗi: ${message.slice(0, 200)}`, 502);
  }
}
