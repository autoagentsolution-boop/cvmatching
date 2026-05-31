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

export const runtime = 'nodejs';
export const maxDuration = 60;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
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

  // CV embedding — cache lookup or fresh embed
  let cvEmbedding: Float32Array;
  let fromCache = false;
  try {
    const cached = await getCachedEmbedding(body.cvText);
    if (cached) {
      cvEmbedding = cached;
      fromCache = true;
    } else {
      cvEmbedding = await embedText(body.cvText, resolved.apiKey);
      await setCachedEmbedding(body.cvText, cvEmbedding);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('EMBED_CACHE_SECRET')) {
      return err('service_unavailable', 'Cấu hình server thiếu EMBED_CACHE_SECRET. Liên hệ admin.', 503);
    }
    return err('llm_provider_error', `Lỗi tạo embedding: ${msg.slice(0, 200)}`, 502);
  }

  // Top-K candidates from job index
  let candidates: Array<{ id: string; score: number }>;
  try {
    candidates = await topKCandidates(cvEmbedding, 20);
  } catch (e) {
    if (e instanceof JobIndexNotReadyError) {
      return err('service_unavailable', 'Job index chưa sẵn sàng. Vui lòng thử lại sau.', 503);
    }
    return err('internal_error', 'Lỗi tải job index.', 500);
  }
  if (candidates.length === 0) {
    return err('service_unavailable', 'Job index chưa sẵn sàng. Vui lòng thử lại sau.', 503);
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
      llmConfig, resolved.apiKey, system, user,
    ));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logLlmCall({
      endpoint: 'job-recommend', provider: llmConfig.provider, model: llmConfig.model,
      byok: resolved.byok, userId: resolved.userId, status: 'error',
      latencyMs: Date.now() - start, inputChars, error: msg.slice(0, 200),
    });
    return err('llm_provider_error', `LLM lỗi: ${msg.slice(0, 200)}`, 502);
  }

  if (!parsedRaw) {
    await logLlmCall({
      endpoint: 'job-recommend', provider: llmConfig.provider, model: llmConfig.model,
      byok: resolved.byok, userId: resolved.userId, status: 'error',
      latencyMs: Date.now() - start, inputChars, outputChars: raw.length,
      promptTokens, completionTokens, error: 'json_parse_failed',
    });
    return err('llm_provider_error', 'LLM trả về JSON không hợp lệ sau 2 lần thử. Vui lòng thử lại.', 502);
  }

  const matchedJobs = normalizeRecommend(parsedRaw, jobsById);

  if (matchedJobs.length === 0) {
    await logLlmCall({
      endpoint: 'job-recommend', provider: llmConfig.provider, model: llmConfig.model,
      byok: resolved.byok, userId: resolved.userId, status: 'error',
      latencyMs: Date.now() - start, inputChars, outputChars: raw.length,
      promptTokens, completionTokens, error: 'no_matches',
    });
    return err('llm_provider_error', 'Không có job nào khớp đủ cao (>80). Thử cập nhật CV với nhiều chi tiết hơn.', 502);
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
  });
}
