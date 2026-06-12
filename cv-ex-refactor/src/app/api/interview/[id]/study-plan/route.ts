// POST /api/interview/[id]/study-plan
//
// 1-time generation per session (re-roll disabled v1). BYOK-gated.
// Operator-confirmed flow:
//   - Session must be completed (status='completed')
//   - studyPlan must be null (re-attempt returns 409 with existing plan)
//   - BYOK token required — non-admin shared-key path 402s
//   - Output persisted to interview_sessions.study_plan column

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { LlmConfig } from '@/lib/schemas/llm-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { callLLM } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { recordCost, checkKillSwitch } from '@/lib/cost/guard';
import { microUsdCost } from '@/lib/llm/model-prices';
import { enforceIpRateLimit, rateLimitedResponse } from '@/lib/quota/enforce-ip-rate-limit';
import { buildStudyPlanPrompt } from '@/lib/llm/prompt-study-plan';
import { studyPlanSchema } from '@/lib/llm/schemas-study-plan';
import { getSessionById, saveStudyPlan } from '@/lib/interview/storage';
import type { InterviewGrade, InterviewQuestion } from '@/lib/llm/schemas-interview';

export const runtime = 'nodejs';
export const maxDuration = 90;

const BodySchema = z.object({ llm: LlmConfig });

function err(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: { code, message }, ...(extra ?? {}) }, { status });
}

// Shape of persisted graded questions (questions JSONB after submit merges
// user_answer + grade per id). Defensive Zod check at runtime to surface
// bad data without crashing.
const GradedQuestionGuard = z.object({
  id: z.string(),
  type: z.enum(['behavioral', 'technical', 'scenario']),
  question: z.string(),
  rubric: z.object({
    criteria: z.string(),
    excellentSignals: z.array(z.string()),
    failSignals: z.array(z.string()),
  }),
  user_answer: z.string(),
  grade: z.object({
    id: z.string(),
    score: z.number(),
    feedback: z.string(),
    improvements: z.array(z.string()),
  }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rate = await enforceIpRateLimit(req, { endpoint: '/api/interview/study-plan', max: 4, windowSec: 60 });
  if (!rate.ok) return rateLimitedResponse(rate.retryAfterSec);

  const session = await auth();
  if (!session?.user?.id) {
    return err('auth_required', 'Bạn cần đăng nhập để dùng Study Plan.', 401);
  }
  const userId = session.user.id;

  const { id } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err('invalid_json', 'Request body must be valid JSON.', 400);
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return err('invalid_input', parsed.error.issues[0]?.message ?? 'Invalid body.', 400);
  }
  const body = parsed.data;

  const persisted = await getSessionById(id, userId);
  if (!persisted) return err('not_found', 'Session không tồn tại.', 404);

  if (persisted.status !== 'completed') {
    return err('not_completed', 'Cần hoàn thành phỏng vấn (nộp đủ 10 câu) trước khi tạo lộ trình học.', 409);
  }

  // 1-time-per-session contract — return 200 with existing plan instead
  // of 409 so the UI can render it idempotently if the user double-clicks.
  if (persisted.studyPlan) {
    return NextResponse.json({ studyPlan: persisted.studyPlan, alreadyGenerated: true });
  }

  // Defensive: questions JSONB should already carry merged grades after
  // submit; bail with 409 if shape doesn't match (legacy/corrupt session).
  const gradedGuard = z.array(GradedQuestionGuard).length(10).safeParse(persisted.questions);
  if (!gradedGuard.success) {
    return err('session_not_graded', 'Session chưa được chấm hoặc dữ liệu hỏng.', 409);
  }
  const gradedQuestions = gradedGuard.data as Array<
    InterviewQuestion & { user_answer: string; grade: InterviewGrade }
  >;

  const byokToken = req.cookies.get('byok-token')?.value;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim()
    ?? 'unknown';

  const resolved = await resolveApiKey(body.llm, 'interview-study-plan', { byokToken, ip });
  if (!resolved.ok) return err(resolved.code, resolved.message, resolved.status);

  // BYOK-only v1 — operator design intent. Admin can use shared key for
  // testing. Non-admin shared-key callers get a hard 402 with actionable
  // copy pointing at Settings BYOK.
  if (!resolved.byok && !resolved.isAdmin) {
    return err(
      'byok_required',
      'Tính năng Lộ trình học yêu cầu API key riêng. Mở Settings → BYOK để dán key.',
      402,
    );
  }

  if (!resolved.byok && resolved.isAdmin) {
    const killCheck = await checkKillSwitch('interview-study-plan');
    if (!killCheck.ok) {
      return err('service_unavailable', 'Study Plan tạm tắt do vượt ngưỡng chi phí.', 503);
    }
  }

  const targetRole = persisted.mode === 'standalone'
    ? (persisted.roleTitle ?? persisted.anchorRoleTitle)
    : persisted.anchorRoleTitle;
  const locale = persisted.locale ?? 'vi';

  const { system, user } = buildStudyPlanPrompt({
    targetRole,
    anchorRoleTitle: persisted.anchorRoleTitle,
    gradedQuestions,
    dualLens: persisted.dualLens,
    locale,
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
    const validated = parsedRaw ? studyPlanSchema.safeParse(parsedRaw) : { success: false as const };
    if (!validated.success) {
      await logLlmCall({
        endpoint: 'interview-study-plan',
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
      return err('llm_bad_output', 'LLM trả Study Plan JSON không hợp lệ. Thử lại lần nữa.', 502);
    }

    await logLlmCall({
      endpoint: 'interview-study-plan',
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
      await recordCost('interview-study-plan', microUsdCost(body.llm.model, llmRes.promptTokens ?? 0, llmRes.completionTokens ?? 0));
    }

    await saveStudyPlan(persisted.id, userId, validated.data);

    return NextResponse.json({ studyPlan: validated.data, alreadyGenerated: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'interview-study-plan',
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
      return err('upstream_overloaded', 'Provider đang quá tải. Thử lại sau ít phút.', 503);
    }
    if (/Gemini\s+429|RESOURCE_EXHAUSTED|rate.?limit/i.test(message)) {
      return err('upstream_rate_limit', 'Provider đang giới hạn rate. Đợi 30-60s rồi thử lại.', 429);
    }
    if (/40[013]|API key|INVALID_ARGUMENT|unauthorized/i.test(message)) {
      return err('byok_invalid', 'API key không hợp lệ — kiểm tra lại trong Settings.', 402);
    }
    return err('llm_provider_error', `LLM lỗi: ${message.slice(0, 200)}`, 502);
  }
}
