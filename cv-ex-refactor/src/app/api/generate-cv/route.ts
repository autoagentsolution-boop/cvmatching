import { NextRequest, NextResponse } from 'next/server';
import { GenerateCvBody } from '@/lib/schemas/llm-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { buildGenerateCvPrompts } from '@/lib/llm/prompt-generate-cv';
import { callLLM } from '@/lib/llm/providers';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { checkKillSwitch, recordCost } from '@/lib/cost/guard';
import { microUsdCost } from '@/lib/llm/model-prices';

export const runtime = 'nodejs';
export const maxDuration = 60;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function stripCodeFences(md: string): string {
  return md
    .replace(/^```(?:markdown|md)?\s*\n?/i, '')
    .replace(/\n```\s*$/i, '')
    .trim();
}

// Split the model output at the <!--REFINE-NOTES--> separator (preferred) or
// at the first '## Changes Made' / '## Gaps To Address' heading as a fallback
// for outputs from the legacy prompt or models that miss the explicit marker.
// Returns { cv, notes } — `notes` is null when the model produced no meta block.
function splitCvAndNotes(md: string): { cv: string; notes: string | null } {
  const markerIdx = md.indexOf('<!--REFINE-NOTES-->');
  if (markerIdx >= 0) {
    return {
      cv: md.slice(0, markerIdx).trim(),
      notes: md.slice(markerIdx + '<!--REFINE-NOTES-->'.length).trim() || null,
    };
  }
  // Fallback: heading-based split. Match the first occurrence of either heading.
  const headingMatch = md.match(/^##\s+(Changes Made|Gaps To Address[^\n]*)$/im);
  if (headingMatch && headingMatch.index !== undefined) {
    return {
      cv: md.slice(0, headingMatch.index).trim(),
      notes: md.slice(headingMatch.index).trim() || null,
    };
  }
  return { cv: md, notes: null };
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = GenerateCvBody.safeParse(json);
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
  const resolved = await resolveApiKey(body.llm, 'generate-cv', { byokToken, ip });
  if (!resolved.ok) {
    return err(resolved.code, resolved.message, resolved.status);
  }

  if (!resolved.byok && !resolved.isAdmin) {
    const killCheck = await checkKillSwitch('generate-cv');
    if (!killCheck.ok) {
      return err(
        'service_unavailable',
        'Tính năng Generate CV tạm thời bị tắt do vượt ngưỡng chi phí. Vui lòng dùng API key riêng (Settings → BYOK) hoặc thử lại sau.',
        503,
      );
    }
  }

  const { system, user } = buildGenerateCvPrompts(body);
  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    const { text: raw, promptTokens, completionTokens } = await callLLM({
      config: { ...body.llm, apiKey: resolved.apiKey },
      system,
      user,
      expectJson: false,
      // Markdown rewrite — no thinking phase needed; cuts ~30s.
      disableThinking: true,
    });
    const stripped = stripCodeFences(raw);
    const { cv: markdown, notes: refineNotes } = splitCvAndNotes(stripped);
    if (markdown.length < 50) {
      await logLlmCall({
        endpoint: 'generate-cv',
        provider: body.llm.provider,
        model: body.llm.model,
        byok: resolved.byok,
        userId: resolved.userId,
        status: 'error',
        latencyMs: Date.now() - start,
        inputChars,
        outputChars: markdown.length,
        promptTokens,
        completionTokens,
        error: 'empty_output',
      });
      return err('llm_provider_error', 'LLM trả về nội dung rỗng.', 502);
    }

    await logLlmCall({
      endpoint: 'generate-cv',
      provider: body.llm.provider,
      model: body.llm.model,
      byok: resolved.byok,
      userId: resolved.userId,
      status: 'ok',
      latencyMs: Date.now() - start,
      inputChars,
      outputChars: markdown.length,
      promptTokens,
      completionTokens,
    });

    if (!resolved.byok) {
      await recordCost('generate-cv', microUsdCost(body.llm.model, promptTokens ?? 0, completionTokens ?? 0));
    }

    return NextResponse.json({ markdown, refineNotes, quotaRemaining: resolved.quotaRemaining });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'generate-cv',
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
