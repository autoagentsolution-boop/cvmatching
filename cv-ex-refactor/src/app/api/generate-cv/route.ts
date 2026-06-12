import { NextRequest, NextResponse } from 'next/server';
import { GenerateCvBody, GenerateCvV3Body } from '@/lib/schemas/llm-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { enforceIpRateLimit, rateLimitedResponse } from '@/lib/quota/enforce-ip-rate-limit';
import { buildGenerateCvPrompts } from '@/lib/llm/prompt-generate-cv';
import { buildGenerateCvV3Prompts } from '@/lib/llm/prompt-generate-cv-v3';
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

function splitCvAndNotes(md: string): { cv: string; notes: string | null } {
  const markerIdx = md.indexOf('<!--REFINE-NOTES-->');
  if (markerIdx >= 0) {
    return {
      cv: md.slice(0, markerIdx).trim(),
      notes: md.slice(markerIdx + '<!--REFINE-NOTES-->'.length).trim() || null,
    };
  }
  const headingMatch = md.match(/^##\s+(Changes Made|Gaps To Address[^\n]*)$/im);
  if (headingMatch && headingMatch.index !== undefined) {
    return {
      cv: md.slice(0, headingMatch.index).trim(),
      notes: md.slice(headingMatch.index).trim() || null,
    };
  }
  return { cv: md, notes: null };
}

// v0.4: route dispatches by body shape. v3 (CV-solo) carries `findings`; v2
// (CV-vs-JD legacy) carries `analysisSummary` + `inputs.jdText`. Both share
// auth, cost-guard, quota, logging, and the markdown splitter.
function isV3Shape(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false;
  return 'findings' in (json as Record<string, unknown>);
}

export async function POST(req: NextRequest) {
  // Burst rate limit on top of the daily quota — see analyze/route.ts.
  const rate = await enforceIpRateLimit(req, { endpoint: '/api/generate-cv', max: 8, windowSec: 60 });
  if (!rate.ok) return rateLimitedResponse(rate.retryAfterSec);

  const json = await req.json().catch(() => null);
  const byokToken = req.cookies.get('byok-token')?.value;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown';

  const v3 = isV3Shape(json);
  let llmConfig;
  let userId: string | undefined;
  let byok = false;
  let quotaRemaining: number | null = null;
  let isAdmin = false;
  let providerStr = '';
  let modelStr = '';
  let system = '';
  let user = '';

  if (v3) {
    const parsed = GenerateCvV3Body.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.join('.') ?? '';
      const msg = issue?.message ?? 'Body không hợp lệ.';
      return err('invalid_input', path ? `${path}: ${msg}` : msg, 400);
    }
    const body = parsed.data;
    const resolved = await resolveApiKey(body.llm, 'generate-cv', { byokToken, ip });
    if (!resolved.ok) return err(resolved.code, resolved.message, resolved.status);
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
    const built = buildGenerateCvV3Prompts(body);
    system = built.system;
    user = built.user;
    llmConfig = { ...body.llm, apiKey: resolved.apiKey };
    userId = resolved.userId;
    byok = resolved.byok;
    quotaRemaining = resolved.quotaRemaining;
    isAdmin = resolved.isAdmin;
    providerStr = body.llm.provider;
    modelStr = body.llm.model;
  } else {
    const parsed = GenerateCvBody.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.join('.') ?? '';
      const msg = issue?.message ?? 'Body không hợp lệ.';
      return err('invalid_input', path ? `${path}: ${msg}` : msg, 400);
    }
    const body = parsed.data;
    const resolved = await resolveApiKey(body.llm, 'generate-cv', { byokToken, ip });
    if (!resolved.ok) return err(resolved.code, resolved.message, resolved.status);
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
    const built = buildGenerateCvPrompts(body);
    system = built.system;
    user = built.user;
    llmConfig = { ...body.llm, apiKey: resolved.apiKey };
    userId = resolved.userId;
    byok = resolved.byok;
    quotaRemaining = resolved.quotaRemaining;
    isAdmin = resolved.isAdmin;
    providerStr = body.llm.provider;
    modelStr = body.llm.model;
  }
  void isAdmin; // referenced for symmetry; not used in the call itself

  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    const { text: raw, promptTokens, completionTokens } = await callLLM({
      config: llmConfig,
      system,
      user,
      expectJson: false,
      disableThinking: true,
    });
    const stripped = stripCodeFences(raw);
    const { cv: markdown, notes: refineNotes } = splitCvAndNotes(stripped);
    if (markdown.length < 50) {
      await logLlmCall({
        endpoint: 'generate-cv',
        provider: providerStr,
        model: modelStr,
        byok,
        userId,
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
      provider: providerStr,
      model: modelStr,
      byok,
      userId,
      status: 'ok',
      latencyMs: Date.now() - start,
      inputChars,
      outputChars: markdown.length,
      promptTokens,
      completionTokens,
    });

    if (!byok) {
      await recordCost('generate-cv', microUsdCost(modelStr, promptTokens ?? 0, completionTokens ?? 0));
    }

    return NextResponse.json({ markdown, refineNotes, quotaRemaining });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'generate-cv',
      provider: providerStr,
      model: modelStr,
      byok,
      userId,
      status: 'error',
      latencyMs: Date.now() - start,
      inputChars,
      error: message.slice(0, 200),
    });
    return err('llm_provider_error', `LLM lỗi: ${message.slice(0, 200)}`, 502);
  }
}
