// POST /api/interview/submit — grade all 10 answers for an in-progress session.
//
// Flow:
//   1) auth() → JWT userId
//   2) Zod validate body (10 answers, ids q1..q10)
//   3) Load session via ownership-enforcing getSessionById → 404 if missing
//   4) Verify status === 'in_progress' (else 409)
//   5) Verify answer IDs match question IDs (else 400)
//   6) resolveApiKey + BYOK gate (mirror start)
//   7) buildInterviewGradePrompt → callLLM (no fallback for grade — single shot)
//   8) Parse via interviewGradeOutputSchema (failure → 502)
//   9) logLlmCall + recordCost
//  10) Merge grades into questions JSONB + updateGrades(overall_score, status='completed')
//  11) Return 200 { overallScore, gradedQuestions } — rubric stripped
//
// Note: no fallback chain on grade — if the BYOK provider drops the call we
// surface 503 + let the user retry. The session stays in_progress so they
// can re-submit without re-paying for gen.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { InterviewSubmitBody } from '@/lib/schemas/interview-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { enforceIpRateLimit, rateLimitedResponse } from '@/lib/quota/enforce-ip-rate-limit';
import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { recordCost, checkKillSwitch } from '@/lib/cost/guard';
import { microUsdCost } from '@/lib/llm/model-prices';
import { buildInterviewGradePrompt } from '@/lib/llm/prompt-interview-grade';
import {
  interviewGradeOutputSchema,
  computeOverallScore10,
  type InterviewQuestion,
  type InterviewGrade,
} from '@/lib/llm/schemas-interview';
import { getSessionById, updateGrades } from '@/lib/interview/storage';

export const runtime = 'nodejs';
export const maxDuration = 90;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

interface GradedQuestion extends InterviewQuestion {
  user_answer: string;
  grade: InterviewGrade;
}

export async function POST(req: NextRequest) {
  const rate = await enforceIpRateLimit(req, { endpoint: '/api/interview/submit', max: 6, windowSec: 60 });
  if (!rate.ok) return rateLimitedResponse(rate.retryAfterSec);

  const session = await auth();
  if (!session?.user?.id) {
    return err('auth_required', 'Bạn cần đăng nhập để dùng Interview Practice.', 401);
  }
  const userId = session.user.id;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err('invalid_json', 'Request body must be valid JSON.', 400);
  }

  const parsed = InterviewSubmitBody.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    return err('invalid_input', path ? `${path}: ${issue?.message}` : (issue?.message ?? 'Body invalid'), 400);
  }
  const body = parsed.data;

  const persisted = await getSessionById(body.sessionId, userId);
  // 404 (not 403) on ownership mismatch — see security note in plan: avoids
  // existence-leak about other users' sessions.
  if (!persisted) return err('not_found', 'Session không tồn tại.', 404);

  if (persisted.status !== 'in_progress') {
    return err('session_not_in_progress', `Session đã ${persisted.status}. Không thể submit lại.`, 409);
  }

  // Defensive: IDs in answers MUST match the question set exactly. UI
  // should already enforce but defense-in-depth — wrong ids would break
  // the zip-by-id merge below.
  const questionIds = new Set(persisted.questions.map((q) => q.id));
  const answerIds = new Set(body.answers.map((a) => a.id));
  if (questionIds.size !== 10 || answerIds.size !== 10) {
    return err('invalid_input', 'Cần đúng 10 câu trả lời với id q1..q10 duy nhất.', 400);
  }
  for (const id of answerIds) {
    if (!questionIds.has(id)) {
      return err('invalid_input', `Answer id ${id} không khớp với câu hỏi nào.`, 400);
    }
  }

  const byokToken = req.cookies.get('byok-token')?.value;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown';

  const resolved = await resolveApiKey(body.llm, 'interview-grade', { byokToken, ip });
  if (!resolved.ok) return err(resolved.code, resolved.message, resolved.status);

  if (!resolved.byok && !resolved.isAdmin) {
    const cookiePresent = !!byokToken;
    // Structured diagnostic — without this we can't tell from Vercel
    // logs whether the gate fired because the cookie was absent vs
    // present-but-vault-miss vs admin allowlist out of date.
    console.warn('[interview/submit] byok_gate_blocked', {
      cookiePresent,
      cookieLen: byokToken?.length ?? 0,
      resolvedByok: resolved.byok,
      resolvedIsAdmin: resolved.isAdmin,
      hasUserId: !!resolved.userId,
      sessionId: persisted.id,
    });
    return err(
      cookiePresent ? 'byok_expired' : 'byok_required',
      cookiePresent
        ? 'API key BYOK của bạn đã hết hạn (vault TTL 4h) hoặc đã bị xóa. Vào Settings → BYOK dán lại key, rồi bấm Submit lại — session vẫn đang mở.'
        : 'Interview Practice yêu cầu API key riêng. Mở Settings → BYOK để dán key Gemini / OpenAI / Anthropic.',
      402,
    );
  }

  if (!resolved.byok && resolved.isAdmin) {
    const killCheck = await checkKillSwitch('interview-grade');
    if (!killCheck.ok) {
      return err('service_unavailable', 'Interview Practice tạm tắt do vượt ngưỡng chi phí.', 503);
    }
  }

  const targetRole = persisted.mode === 'standalone'
    ? (persisted.roleTitle ?? persisted.anchorRoleTitle)
    : persisted.anchorRoleTitle;

  // Prefer the locale resolved + persisted at start time so grade follows
  // the language the questions were written in. Falls back to body.locale
  // for legacy sessions created before locale persistence shipped.
  const sessionLocale = persisted.locale ?? (body.locale === 'en' || body.locale === 'vi' ? body.locale : 'vi');

  const { system, user } = buildInterviewGradePrompt({
    questions: persisted.questions,
    answers: body.answers.map((a) => ({ id: a.id, userAnswer: a.answer })),
    targetRole,
    locale: sessionLocale,
  });

  const inputChars = system.length + user.length;
  const start = Date.now();

  try {
    const llmRes = await callLLM({
      config: { ...body.llm, apiKey: resolved.apiKey },
      system,
      user,
      expectJson: true,
      disableThinking: true,
    });

    const parsedRaw = safeParseJson(llmRes.text);
    const validated = parsedRaw ? interviewGradeOutputSchema.safeParse(parsedRaw) : { success: false as const };
    if (!validated.success) {
      await logLlmCall({
        endpoint: 'interview-grade',
        provider: body.llm.provider,
        model: body.llm.model,
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
      return err('llm_bad_output', 'LLM trả grade JSON không hợp lệ. Thử lại lần nữa.', 502);
    }
    const grades = validated.data;

    // Confirm grade ids are exactly the question ids (Zod refined for unique,
    // but not that they match the input question set).
    const gradeIds = new Set(grades.map((g) => g.id));
    for (const id of questionIds) {
      if (!gradeIds.has(id)) {
        await logLlmCall({
          endpoint: 'interview-grade',
          provider: body.llm.provider,
          model: body.llm.model,
          byok: resolved.byok,
          userId,
          status: 'error',
          latencyMs: Date.now() - start,
          inputChars,
          outputChars: llmRes.text.length,
          error: 'grade_id_mismatch',
        });
        return err('llm_bad_output', 'LLM trả grade với id sai. Thử lại lần nữa.', 502);
      }
    }

    await logLlmCall({
      endpoint: 'interview-grade',
      provider: body.llm.provider,
      model: body.llm.model,
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
      await recordCost('interview-grade', microUsdCost(body.llm.model, llmRes.promptTokens ?? 0, llmRes.completionTokens ?? 0));
    }

    // Merge grades + answers into the questions JSONB (zip by id). Preserves
    // original question + rubric so the results page can render full context.
    const gradeById = new Map(grades.map((g) => [g.id, g]));
    const answerById = new Map(body.answers.map((a) => [a.id, a.answer]));
    const mergedQuestions: GradedQuestion[] = persisted.questions.map((q) => ({
      ...q,
      user_answer: answerById.get(q.id) ?? '',
      grade: gradeById.get(q.id)!,
    }));

    const overallScore10 = computeOverallScore10(grades);
    const overallScoreInt = Math.round(overallScore10 * 10); // 0..100 INTEGER

    await updateGrades(persisted.id, userId, {
      questions: mergedQuestions,
      overallScoreInt,
    });

    // Strip rubric in response (still persisted server-side for the
    // results page server component to render via its own load).
    return NextResponse.json({
      overallScore: overallScore10,
      gradedQuestions: mergedQuestions.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        userAnswer: q.user_answer,
        grade: q.grade,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'interview-grade',
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
      return err('upstream_overloaded', 'Provider đang quá tải. Session vẫn mở — bấm Submit lại sau ít phút.', 503);
    }
    if (/Gemini\s+429|RESOURCE_EXHAUSTED|rate.?limit/i.test(message)) {
      return err('upstream_rate_limit', 'Provider đang giới hạn rate. Đợi 30-60s rồi submit lại.', 429);
    }
    if (/40[013]|API key|INVALID_ARGUMENT|unauthorized/i.test(message)) {
      return err('byok_invalid', 'API key không hợp lệ — kiểm tra lại trong Settings.', 402);
    }
    return err('llm_provider_error', `LLM lỗi: ${message.slice(0, 200)}`, 502);
  }
}
