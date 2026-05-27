import { NextRequest, NextResponse } from 'next/server';
import { ExtractMustHavesBody } from '@/lib/schemas/llm-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { buildMustHavePrompts } from '@/lib/llm/prompt-must-haves';
import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 30;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = ExtractMustHavesBody.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    const msg = issue?.message ?? 'Body không hợp lệ.';
    return err('invalid_input', path ? `${path}: ${msg}` : msg, 400);
  }

  const body = parsed.data;
  const resolved = await resolveApiKey(body.llm, 'extract-must-haves');
  if (!resolved.ok) {
    return err(resolved.code, resolved.message, resolved.status);
  }

  const { system, user } = buildMustHavePrompts(body);
  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    const { text: raw, promptTokens, completionTokens } = await callLLM({
      config: { ...body.llm, apiKey: resolved.apiKey },
      system,
      user,
      expectJson: true,
    });

    const parsedRaw = safeParseJson<{ mustHaves?: unknown }>(raw);
    const mustHaves = Array.isArray(parsedRaw?.mustHaves)
      ? parsedRaw.mustHaves
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim().replace(/^[-•*·]\s*/, ''))
          .filter((x) => x.length > 0)
          .slice(0, 15)
      : [];

    if (mustHaves.length === 0) {
      await logLlmCall({
        endpoint: 'extract-must-haves',
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
        error: 'no_items',
      });
      return err('llm_provider_error', 'Không trích được yêu cầu bắt buộc.', 502);
    }

    if (mustHaves.length < 5) {
      console.warn('[extract-must-haves] low item count', {
        provider: body.llm.provider,
        model: body.llm.model,
        itemCount: mustHaves.length,
        ...(env.LOG_LLM_DEBUG === '1' ? { rawPreview: raw.slice(0, 800) } : {}),
      });
    }

    await logLlmCall({
      endpoint: 'extract-must-haves',
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

    return NextResponse.json({ mustHaves, quotaRemaining: resolved.quotaRemaining });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'extract-must-haves',
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
