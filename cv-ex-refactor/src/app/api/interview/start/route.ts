// POST /api/interview/start — generate Dual Lens + 10 questions for a session.
//
// Flow:
//   1) auth() → JWT userId required
//   2) Zod validate body
//   3) resolveApiKey (BYOK or admin only — v1 refuses non-admin shared key)
//   4) Look up active session for this (user, jobId|roleTitleHash)
//        → 409 with sessionId for client redirect
//   5) Load CV body + (job_fit) job description
//   6) buildInterviewGenPrompt → callLLMWithFallback (Gemini chain) / callLLM
//   7) Parse via interviewGenOutputSchema (schema-validation failure → 502)
//   8) logLlmCall + recordCost (admin shared only — no-op for BYOK)
//   9) ensureUserRow + createSession
//  10) Return 200 { sessionId, dualLens, questions: stripped of rubric }
//
// Memory:
//  - feedback_error_surfacing_no_silent_fallback — 402/409/503 surface
//  - feedback_token_tracking_coverage — logLlmCall at every LLM site
//  - feedback_jwt_auth_fk_upsert_pattern — ensureUserRow before FK insert
//  - feedback_no_auto_llm_calls — caller MUST be onClick handler

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { InterviewStartBody } from '@/lib/schemas/interview-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { enforceIpRateLimit, rateLimitedResponse } from '@/lib/quota/enforce-ip-rate-limit';
import { callLLM, callLLMWithFallback, geminiFallbackChain } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { recordCost, checkKillSwitch } from '@/lib/cost/guard';
import { microUsdCost } from '@/lib/llm/model-prices';
import { buildInterviewGenPrompt } from '@/lib/llm/prompt-interview-gen';
import { interviewGenOutputSchema } from '@/lib/llm/schemas-interview';
import { detectLocaleFromText, type ResolvedLocale } from '@/lib/llm/detect-locale';
import {
  createSession,
  findActiveSessionByUniqueKey,
} from '@/lib/interview/storage';
import { getUserCv, ensureUserRow } from '@/lib/cvs/repo';
import { getJob } from '@/lib/jobs/repo-postgres';

export const runtime = 'nodejs';
export const maxDuration = 90;

function err(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: { code, message }, ...(extra ?? {}) }, { status });
}

export async function POST(req: NextRequest) {
  // Burst limit — interview-gen is the most expensive single LLM call in
  // the app (~6-8k output tokens). Even though BYOK-gated, a buggy client
  // could hammer this and drain the user's own provider quota.
  const rate = await enforceIpRateLimit(req, { endpoint: '/api/interview/start', max: 6, windowSec: 60 });
  if (!rate.ok) return rateLimitedResponse(rate.retryAfterSec);

  const session = await auth();
  if (!session?.user?.id) {
    return err('auth_required', 'Bạn cần đăng nhập để dùng Luyện phỏng vấn.', 401);
  }
  const userId = session.user.id;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err('invalid_json', 'Request body must be valid JSON.', 400);
  }

  const parsed = InterviewStartBody.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    return err('invalid_input', path ? `${path}: ${issue?.message}` : (issue?.message ?? 'Body invalid'), 400);
  }
  const body = parsed.data;

  const byokToken = req.cookies.get('byok-token')?.value;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown';

  const resolved = await resolveApiKey(body.llm, 'interview-gen', { byokToken, ip });
  if (!resolved.ok) return err(resolved.code, resolved.message, resolved.status);

  // v1 BYOK-only: shared-key callers (non-admin) are bounced with an
  // actionable BYOK CTA. Admin keeps shared access so the operator can
  // test in prod without burning BYOK quota.
  if (!resolved.byok && !resolved.isAdmin) {
    const cookiePresent = !!byokToken;
    console.warn('[interview/start] byok_gate_blocked', {
      cookiePresent,
      cookieLen: byokToken?.length ?? 0,
      resolvedByok: resolved.byok,
      resolvedIsAdmin: resolved.isAdmin,
      hasUserId: !!resolved.userId,
    });
    return err(
      cookiePresent ? 'byok_expired' : 'byok_required',
      cookiePresent
        ? 'Khóa AI của bạn đã hết hạn. Vào Cài đặt nhập lại khóa rồi bắt đầu lại.'
        : 'Tính năng này cần khóa AI cá nhân. Mở Cài đặt để nhập khóa của bạn.',
      402,
    );
  }

  if (!resolved.byok && resolved.isAdmin) {
    const killCheck = await checkKillSwitch('interview-gen');
    if (!killCheck.ok) {
      return err('service_unavailable', 'Tính năng này tạm thời không khả dụng. Thử lại sau ít phút.', 503);
    }
  }

  // Resume existing active session (partial-unique-index predicate match).
  const existing = await findActiveSessionByUniqueKey({
    userId,
    mode: body.mode,
    jobId: body.jobId ?? null,
    roleTitle: body.mode === 'standalone' ? body.roleTitle ?? null : null,
  });
  if (existing) {
    return NextResponse.json(
      { ok: false, error: { code: 'resume_existing', message: 'Bạn có phiên đang mở cho mục tiêu này — bấm để tiếp tục.' }, sessionId: existing.id },
      { status: 409 },
    );
  }

  // Anchor CV body — owned-row check enforced inside getUserCv.
  const cv = await getUserCv(userId, body.cvId);
  if (!cv) return err('cv_not_found', 'CV không tồn tại hoặc không thuộc về bạn.', 404);

  // job_fit JD source: Postgres jobs table.
  let jobDescription: string | undefined;
  let companyName: string | undefined;
  if (body.mode === 'job_fit') {
    const job = await getJob(body.jobId!);
    if (!job) return err('unknown_job', 'Không tìm thấy job này.', 404);
    jobDescription = job.description;
    companyName = job.company;
  }

  // Resolve 'auto' to a concrete locale server-side. Priority:
  //   1) user setting (body.locale === 'vi' | 'en') wins
  //   2) else heuristic-detect from anchor CV content (with fallback to
  //      role title + JD as additional signal)
  // The LLM is then forbidden from "deciding" the language — caught
  // 2026-06-12 when negative-quadrant content drifted to English on VN
  // CVs because the directive was buried at the bottom of the user
  // prompt and 'auto' explicitly let the model pick.
  const resolvedLocale: ResolvedLocale =
    body.locale === 'vi' || body.locale === 'en'
      ? body.locale
      : detectLocaleFromText(
          [cv.content, body.anchorRoleTitle, body.roleTitle ?? '', jobDescription ?? '']
            .filter(Boolean)
            .join(' '),
        );

  const { system, user } = buildInterviewGenPrompt({
    mode: body.mode,
    targetRole: body.mode === 'job_fit' ? 'TARGET ROLE FROM JD' : body.roleTitle!,
    ...(jobDescription ? { jobDescription } : {}),
    ...(companyName ? { companyName } : {}),
    anchorRoleTitle: body.anchorRoleTitle,
    anchorRoleSummary: cv.content,
    locale: resolvedLocale,
  });

  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    const fallbackModels =
      body.llm.provider === 'gemini' ? geminiFallbackChain(body.llm.model) : [];
    const llmRes = await callLLMWithFallback({
      config: { ...body.llm, apiKey: resolved.apiKey },
      system,
      user,
      expectJson: true,
      disableThinking: true,
      fallbackModels,
      retries: 1,
    });

    const parsedRaw = safeParseJson(llmRes.text);
    const validated = parsedRaw ? interviewGenOutputSchema.safeParse(parsedRaw) : { success: false as const };
    if (!validated.success) {
      await logLlmCall({
        endpoint: 'interview-gen',
        provider: body.llm.provider,
        model: llmRes.actualModel,
        byok: resolved.byok,
        userId,
        status: 'error',
        latencyMs: Date.now() - start,
        inputChars,
        outputChars: llmRes.text.length,
        promptTokens: llmRes.promptTokens,
        completionTokens: llmRes.completionTokens,
        error: 'schema_validation_failed',
      });
      return err('llm_bad_output', 'AI trả định dạng không hợp lệ. Thử lại.', 502);
    }

    await logLlmCall({
      endpoint: 'interview-gen',
      provider: body.llm.provider,
      model: llmRes.actualModel,
      byok: resolved.byok,
      userId,
      status: 'ok',
      latencyMs: Date.now() - start,
      inputChars,
      outputChars: llmRes.text.length,
      promptTokens: llmRes.promptTokens,
      completionTokens: llmRes.completionTokens,
    });

    if (!resolved.byok) {
      await recordCost('interview-gen', microUsdCost(llmRes.actualModel, llmRes.promptTokens ?? 0, llmRes.completionTokens ?? 0));
    }

    await ensureUserRow(userId, session.user.email ?? null);

    // Persist session. Catch the unique-constraint race (concurrent start
    // requests) and re-resolve to the existing row → 409 resume.
    try {
      const persisted = await createSession({
        userId,
        mode: body.mode,
        jobId: body.jobId ?? null,
        roleTitle: body.mode === 'standalone' ? body.roleTitle ?? null : null,
        anchorRoleTitle: body.anchorRoleTitle,
        questions: validated.data.questions,
        dualLens: validated.data.dualLens,
        locale: resolvedLocale,
      });

      return NextResponse.json({
        sessionId: persisted.id,
        dualLens: persisted.dualLens,
        // Strip rubric — preventing the candidate from gaming answers.
        questions: persisted.questions.map((q) => ({ id: q.id, type: q.type, question: q.question })),
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m.includes('23505') || /unique/i.test(m)) {
        const raced = await findActiveSessionByUniqueKey({
          userId,
          mode: body.mode,
          jobId: body.jobId ?? null,
          roleTitle: body.mode === 'standalone' ? body.roleTitle ?? null : null,
        });
        if (raced) {
          return NextResponse.json(
            { ok: false, error: { code: 'resume_existing', message: 'Phiên đang mở — bấm để tiếp tục.' }, sessionId: raced.id },
            { status: 409 },
          );
        }
      }
      throw e;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'interview-gen',
      provider: body.llm.provider,
      model: body.llm.model,
      byok: resolved.byok,
      userId,
      status: 'error',
      latencyMs: Date.now() - start,
      inputChars,
      error: message.slice(0, 200),
    });
    if (/Gemini\s+5(?:0[023])|UNAVAILABLE|high demand|overload/i.test(message)) {
      return err('upstream_overloaded', 'AI đang quá tải. Thử lại sau 1-2 phút.', 503);
    }
    if (/Gemini\s+429|RESOURCE_EXHAUSTED|rate.?limit/i.test(message)) {
      return err('upstream_rate_limit', 'AI đang giới hạn tốc độ. Đợi 30-60 giây rồi thử lại.', 429);
    }
    if (/(?:^|\s)40[13]\b|API key|PERMISSION_DENIED|unauthorized/i.test(message)) {
      return err('byok_invalid', 'Khóa AI không hợp lệ — kiểm tra lại trong Cài đặt.', 402);
    }
    return err('llm_provider_error', 'AI gặp lỗi. Thử lại sau ít phút.', 502);
  }
}
