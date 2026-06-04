// v0.4 CV-Solo /api/analyze handler — separated from route.ts so the route
// stays a thin dispatcher and the v3 logic is unit-testable in isolation.
//
// Flow:
//   1. resolveApiKey (BYOK / shared / admin) + kill-switch
//   2. If `role` not provided → run role-infer LLM call
//        - low confidence → return { needsRoleConfirm, candidates, schemaVersion }
//        - high confidence → use inferred canonical as targetRole
//   3. Run scoring LLM call with buildAnalyzeV3Prompts(cvText, targetRole)
//   4. Parse + normalize via existing normalizeAnalysis (handles v3 shape:
//      empty coverage, optional jdSignal, detectedRole supported)
//   5. Return normalized result + schemaVersion + inferredRole metadata
//
// See plans/260604-1356-v04-cv-solo-analyze-pivot/phase-02-api-analyze-refactor.md

import { NextResponse } from 'next/server';
import type { AnalyzeV3BodyT } from '@/lib/schemas/llm-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { buildAnalyzeV3Prompts } from '@/lib/llm/prompt-analyze-v3';
import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import { normalizeAnalysis } from '@/lib/llm/normalize-analysis';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { checkKillSwitch, recordCost } from '@/lib/cost/guard';
import { microUsdCost } from '@/lib/llm/model-prices';
import {
  inferRoleFromCv,
  isHighConfidence,
  buildCandidates,
} from '@/lib/llm/role-infer';
import { env } from '@/lib/env';

const SCHEMA_VERSION = 'v3' as const;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export interface HandleAnalyzeV3Context {
  byokToken?: string | undefined;
  ip: string;
}

export async function handleAnalyzeV3(
  body: AnalyzeV3BodyT,
  ctx: HandleAnalyzeV3Context,
) {
  const resolved = await resolveApiKey(body.llm, 'analyze', {
    ...(ctx.byokToken ? { byokToken: ctx.byokToken } : {}),
    ip: ctx.ip,
  });
  if (!resolved.ok) return err(resolved.code, resolved.message, resolved.status);

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

  const { cvText, profileText, language, role: userRole } = body.inputs;
  const llmConfig = { ...body.llm, apiKey: resolved.apiKey };

  // Stage 1: role inference (skipped when client already supplied role)
  let targetRole = userRole?.trim();
  let inferredRole: { canonical: string; confidence: number } | undefined;

  if (!targetRole) {
    const inferStart = Date.now();
    const infer = await inferRoleFromCv({ cvText, language, llm: llmConfig });

    if (!infer.ok) {
      await logLlmCall({
        endpoint: 'analyze',
        provider: body.llm.provider,
        model: body.llm.model,
        byok: resolved.byok,
        ...(resolved.userId ? { userId: resolved.userId } : {}),
        status: 'error',
        latencyMs: Date.now() - inferStart,
        inputChars: cvText.length,
        error: infer.code,
      });
      return err(infer.code, infer.message, infer.status);
    }

    if (!resolved.byok) {
      await recordCost(
        'analyze',
        microUsdCost(body.llm.model, infer.promptTokens ?? 0, infer.completionTokens ?? 0),
      );
    }

    inferredRole = { canonical: infer.result.canonical, confidence: infer.result.confidence };

    if (!isHighConfidence(infer.result)) {
      return NextResponse.json({
        schemaVersion: SCHEMA_VERSION,
        needsRoleConfirm: true,
        candidates: buildCandidates(infer.result),
        quotaRemaining: resolved.quotaRemaining,
      });
    }

    targetRole = infer.result.canonical;
  }

  // Stage 2: scoring
  const todayIso = new Date().toISOString().slice(0, 10);
  const { system, user } = buildAnalyzeV3Prompts({
    cvText,
    role: targetRole,
    language,
    todayIso,
    ...(profileText ? { profileText } : {}),
  });
  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    const { text: raw, promptTokens, completionTokens } = await callLLM({
      config: llmConfig,
      system,
      user,
      expectJson: true,
      // v0.4 hotfix: v3 scoring prompt is structured JSON with a clear rubric.
      // Gemini 2.5's thinking phase added 40-50s without quality gain on smoke
      // (52s second-call observed in prod 2026-06-04). Disable it — matches
      // the recommend/generate-cv treatment for structured-output tasks.
      disableThinking: true,
    });

    const parsedRaw = safeParseJson(raw);
    if (!parsedRaw) {
      console.warn('[api/analyze:v3] json_parse_failed', {
        provider: body.llm.provider,
        model: body.llm.model,
        outputChars: raw.length,
        ...(env.LOG_LLM_DEBUG === '1'
          ? { rawHead: raw.slice(0, 400), rawTail: raw.slice(-200) }
          : {}),
      });
      await logLlmCall({
        endpoint: 'analyze',
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
      await recordCost(
        'analyze',
        microUsdCost(body.llm.model, promptTokens ?? 0, completionTokens ?? 0),
      );
    }

    return NextResponse.json({
      ...result,
      schemaVersion: SCHEMA_VERSION,
      ...(inferredRole ? { inferredRole } : {}),
      targetRole,
      quotaRemaining: resolved.quotaRemaining,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'analyze',
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
