import { NextRequest, NextResponse } from 'next/server';
import { RecommendBodySchema } from '@/lib/schemas/job-recommend-request';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { checkKillSwitch, recordCost } from '@/lib/cost/guard';
import { getCachedEmbedding, setCachedEmbedding } from '@/lib/jobs/embed-cache';
import { embedText } from '@/lib/jobs/embed';
import { topKCandidates, JobIndexNotReadyError } from '@/lib/jobs/score';
import { getJobBatch } from '@/lib/jobs/repo';
import { buildRecommendPrompts } from '@/lib/llm/prompt-job-recommend';
import { normalizeRecommend } from '@/lib/llm/normalize-job-recommend';
import { microUsdCost } from '@/lib/llm/model-prices';
import { logLlmCall } from '@/lib/llm/safe-logger';
import { callRecommendLlm } from './llm-call-with-retry';
import type { Job } from '@/lib/jobs/types';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Internal deadline = maxDuration − safety buffer. Hits ~5s before Vercel's
// hard kill so our catch block can still return a structured error body
// (otherwise the user sees a bare 504 with no JSON).
const DEADLINE_BUFFER_MS = 5_000;
const INTERNAL_DEADLINE_MS = maxDuration * 1000 - DEADLINE_BUFFER_MS;

interface ErrDetail {
  stage?: string;
  elapsedMs?: number;
  budgetMs?: number;
  upstreamStatus?: number;
  upstreamRaw?: string;
}

function err(
  code: string,
  message: string,
  status: number,
  detail?: ErrDetail,
) {
  const body: { ok: false; error: { code: string; message: string; detail?: ErrDetail } } = {
    ok: false,
    error: { code, message },
  };
  if (detail) body.error.detail = detail;
  return NextResponse.json(body, { status });
}

function isAbortLike(e: unknown): boolean {
  if (!e) return false;
  const name = (e as { name?: unknown }).name;
  const msg = e instanceof Error ? e.message : String(e);
  return name === 'AbortError' || /abort|signal is aborted|deadline/i.test(msg);
}

function classifyLlmError(msg: string): { code: string; status: number; userMsg: string } {
  // Gemini-specific upstream signals
  if (/Gemini\s+429|RESOURCE_EXHAUSTED|rate.?limit/i.test(msg)) {
    return {
      code: 'upstream_rate_limit',
      status: 429,
      userMsg: 'Gemini đang giới hạn rate (free tier). Đợi 30-60s rồi thử lại, hoặc dùng API key riêng (Settings → BYOK) để bypass.',
    };
  }
  if (/Gemini\s+503|UNAVAILABLE|high demand|overload/i.test(msg)) {
    return {
      code: 'upstream_overloaded',
      status: 503,
      userMsg: 'Model Gemini đang quá tải. Thử lại sau 1-2 phút.',
    };
  }
  if (/Gemini\s+50[02]|INTERNAL|Internal error/i.test(msg)) {
    return {
      code: 'upstream_internal',
      status: 502,
      userMsg: 'Gemini báo lỗi internal — vấn đề ở phía Google. Thử lại sau ít phút.',
    };
  }
  if (/Gemini\s+40[013]|INVALID_ARGUMENT|API key/i.test(msg)) {
    return {
      code: 'upstream_auth',
      status: 502,
      userMsg: 'API key Gemini không hợp lệ hoặc payload sai format. Nếu đang dùng BYOK, hãy kiểm tra key.',
    };
  }
  return { code: 'llm_provider_error', status: 502, userMsg: `LLM lỗi: ${msg.slice(0, 200)}` };
}

export async function POST(req: NextRequest) {
  // v0.3 pilot lockdown: route is admin-only while the 150-job KV seed is
  // being tested. UI lockdown already hides sidebar + CTA + page subtree;
  // this handler-level gate prevents direct POST by anyone who guesses the URL.
  const session = await getSession().catch(() => null);
  if (!isAdminUser(session?.user)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = RecommendBodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    const msg = issue?.message ?? 'Body không hợp lệ.';
    return err('invalid_input', path ? `${path}: ${msg}` : msg, 400);
  }

  const body = parsed.data;
  const llmConfig = body.llm ?? { provider: 'gemini' as const, model: 'gemini-2.5-flash', temperature: 0.3 };

  const byokToken = req.cookies.get('byok-token')?.value;
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip')?.trim() ??
    'unknown';

  const resolved = await resolveApiKey(llmConfig, 'job-recommend', { byokToken, ip });
  if (!resolved.ok) return err(resolved.code, resolved.message, resolved.status);

  const killCheck = await checkKillSwitch('job-recommend');
  if (!killCheck.ok) {
    return err('service_unavailable', 'Tính năng Job Fit tạm thời bị tắt do vượt ngưỡng chi phí. Vui lòng thử lại sau.', 503);
  }

  const requestStart = Date.now();
  const deadlineController = new AbortController();
  const deadlineTimer = setTimeout(() => deadlineController.abort(), INTERNAL_DEADLINE_MS);
  const stageTimings: Record<string, number> = {};

  function stageElapsed(): number {
    return Date.now() - requestStart;
  }

  try {
    // CV embedding — cache lookup or fresh embed
    let cvEmbedding: Float32Array;
    let fromCache = false;
    const embedStart = Date.now();
    try {
      const cached = await getCachedEmbedding(body.cvText);
      if (cached) {
        cvEmbedding = cached;
        fromCache = true;
      } else {
        cvEmbedding = await embedText(body.cvText, resolved.apiKey, deadlineController.signal);
        await setCachedEmbedding(body.cvText, cvEmbedding);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('EMBED_CACHE_SECRET')) {
        return err('service_unavailable', 'Cấu hình server thiếu EMBED_CACHE_SECRET. Liên hệ admin.', 503);
      }
      if (isAbortLike(e) || deadlineController.signal.aborted) {
        return err(
          'request_timeout',
          `Quá hạn ${Math.round(INTERNAL_DEADLINE_MS / 1000)}s khi tạo embedding cho CV. CV của bạn có thể quá dài hoặc Gemini đang chậm. Thử CV ngắn hơn (≤ 5000 ký tự) hoặc đợi 1-2 phút.`,
          504,
          { stage: 'embed', elapsedMs: stageElapsed(), budgetMs: INTERNAL_DEADLINE_MS },
        );
      }
      const classified = classifyLlmError(msg);
      return err(classified.code, `Lỗi tạo embedding — ${classified.userMsg}`, classified.status, {
        stage: 'embed',
        elapsedMs: stageElapsed(),
        upstreamRaw: msg.slice(0, 200),
      });
    }
    stageTimings.embed = Date.now() - embedStart;

    // Top-K candidates from job index
    let candidates: Array<{ id: string; score: number }>;
    const topkStart = Date.now();
    try {
      candidates = await topKCandidates(cvEmbedding, 20);
    } catch (e) {
      if (e instanceof JobIndexNotReadyError) {
        return err('service_unavailable', 'Job index chưa sẵn sàng. Pool jobs trống — admin cần ingest trước.', 503);
      }
      return err('internal_error', `Lỗi tải job index: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`, 500, {
        stage: 'topk',
        elapsedMs: stageElapsed(),
      });
    }
    stageTimings.topk = Date.now() - topkStart;
    if (candidates.length === 0) {
      return err('service_unavailable', 'Job index chưa sẵn sàng (0 candidates). Admin cần ingest trước.', 503);
    }

    const jobs = await getJobBatch(candidates.map((c) => c.id));
    const jobsById = new Map<string, Job>(jobs.map((j) => [j.id, j]));

    const { system, user } = buildRecommendPrompts({
      cvText: body.cvText,
      candidates: jobs.map((j) => ({
        id: j.id, title: j.title, company: j.company,
        vertical: j.vertical, seniority: j.seniority, description: j.description,
      })),
    });

    const inputChars = system.length + user.length;
    const start = Date.now();

    // LLM call (with one retry on parse failure)
    let raw: string;
    let parsedRaw: unknown;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    try {
      ({ raw, parsedRaw, promptTokens, completionTokens } = await callRecommendLlm(
        llmConfig, resolved.apiKey, system, user, deadlineController.signal,
      ));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const llmElapsed = Date.now() - start;
      await logLlmCall({
        endpoint: 'job-recommend', provider: llmConfig.provider, model: llmConfig.model,
        byok: resolved.byok, userId: resolved.userId, status: 'error',
        latencyMs: llmElapsed, inputChars, error: msg.slice(0, 200),
      });
      if (isAbortLike(e) || deadlineController.signal.aborted) {
        return err(
          'request_timeout',
          `Gemini không phản hồi trong ${Math.round(INTERNAL_DEADLINE_MS / 1000)}s. CV/job pool lớn (${jobs.length} candidates, ${inputChars} ký tự prompt). Thử lại sau 1-2 phút, hoặc dùng BYOK key (Settings) — key riêng thường nhanh hơn shared.`,
          504,
          {
            stage: 'llm',
            elapsedMs: stageElapsed(),
            budgetMs: INTERNAL_DEADLINE_MS,
          },
        );
      }
      const classified = classifyLlmError(msg);
      return err(classified.code, classified.userMsg, classified.status, {
        stage: 'llm',
        elapsedMs: stageElapsed(),
        upstreamRaw: msg.slice(0, 200),
      });
    }
    stageTimings.llm = Date.now() - start;

    if (!parsedRaw) {
      await logLlmCall({
        endpoint: 'job-recommend', provider: llmConfig.provider, model: llmConfig.model,
        byok: resolved.byok, userId: resolved.userId, status: 'error',
        latencyMs: Date.now() - start, inputChars, outputChars: raw.length,
        promptTokens, completionTokens, error: 'json_parse_failed',
      });
      return err(
        'llm_invalid_json',
        'Gemini trả về JSON không hợp lệ sau 2 lần thử. Có thể model bị truncate output — thử lại hoặc giảm số ký tự CV.',
        502,
        { stage: 'llm', elapsedMs: stageElapsed() },
      );
    }

    const matchedJobs = normalizeRecommend(parsedRaw, jobsById);

    if (matchedJobs.length === 0) {
      await logLlmCall({
        endpoint: 'job-recommend', provider: llmConfig.provider, model: llmConfig.model,
        byok: resolved.byok, userId: resolved.userId, status: 'error',
        latencyMs: Date.now() - start, inputChars, outputChars: raw.length,
        promptTokens, completionTokens, error: 'no_matches',
      });
      return err(
        'no_matches',
        'Không có job nào khớp đủ cao (>80 điểm). Thử cập nhật CV với nhiều chi tiết kỹ năng/kinh nghiệm hơn, hoặc đợi pool jobs cập nhật.',
        502,
        { stage: 'normalize', elapsedMs: stageElapsed() },
      );
    }

    await recordCost('job-recommend', microUsdCost(llmConfig.model, promptTokens ?? 0, completionTokens ?? 0));

    await logLlmCall({
      endpoint: 'job-recommend', provider: llmConfig.provider, model: llmConfig.model,
      byok: resolved.byok, userId: resolved.userId, status: 'ok',
      latencyMs: Date.now() - start, inputChars, outputChars: raw.length,
      promptTokens, completionTokens,
    });

    return NextResponse.json({
      jobs: matchedJobs,
      fromCache,
      expiresAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      quotaRemaining: resolved.quotaRemaining,
      timings: stageTimings,
    });
  } catch (e) {
    if (isAbortLike(e) || deadlineController.signal.aborted) {
      return err(
        'request_timeout',
        `Yêu cầu vượt ${Math.round(INTERNAL_DEADLINE_MS / 1000)}s. Thử lại hoặc dùng BYOK key (Settings).`,
        504,
        { elapsedMs: stageElapsed(), budgetMs: INTERNAL_DEADLINE_MS },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    return err('internal_error', `Lỗi không xác định: ${msg.slice(0, 200)}`, 500, {
      elapsedMs: stageElapsed(),
    });
  } finally {
    clearTimeout(deadlineTimer);
  }
}
