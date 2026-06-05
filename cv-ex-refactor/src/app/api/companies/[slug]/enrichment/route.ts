// POST /api/companies/[slug]/enrichment
//
// Public endpoint — fires Gemini grounded-search to populate Tier 2 enrichment
// (summary + pros/cons + citations). Lazy-on-first-detail-open pattern: client
// CompanyCard GETs /api/companies/[slug] first; if enrichment missing/stale,
// fires this POST and awaits ~5-15s.
//
// Cost gating:
//   - resolveApiKey gates auth + admin bypass
//   - checkKillSwitch('company-enrich') honors per-bucket cost-WARN/KILL
//   - recordCost increments daily spend bucket
//   - 30d cache prevents repeat enrichment for same slug
//
// Error surfacing per [[feedback_error_surfacing_no_silent_fallback]]:
//   - 404 when slug missing (silent ok at client — UI hides enrichment block)
//   - 502 on LLM provider error / schema violation
//   - 503 on kill-switch tripped
//   - 200 + insufficientSources flag when grounded search returned <2 sources
//     (legitimate guard, not an error)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveApiKey } from '@/lib/llm/resolve-api-key';
import { checkKillSwitch, recordCost } from '@/lib/cost/guard';
import { microUsdCost } from '@/lib/llm/model-prices';
import { LlmConfig } from '@/lib/schemas/llm-request';
import { getCompany, mergeEnrichment } from '@/lib/companies/kv-client';
import { enrichCompany, isEnrichmentStale } from '@/lib/companies/enrichment';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RequestBody = z.object({
  llm: LlmConfig,
  /** When true, ignore cache + force re-enrichment. Admin-only path. */
  force: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  if (!slug || slug.length > 80 || !/^[a-z0-9-]+$/.test(slug)) {
    return err('invalid_slug', 'Slug không hợp lệ.', 400);
  }

  const json = await req.json().catch(() => null);
  const parsed = RequestBody.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    return err('invalid_input', path ? `${path}: ${issue?.message}` : 'Body không hợp lệ.', 400);
  }
  const body = parsed.data;

  const byokToken = req.cookies.get('byok-token')?.value;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const resolved = await resolveApiKey(body.llm, 'company-enrich', { byokToken, ip });
  if (!resolved.ok) return err(resolved.code, resolved.message, resolved.status);

  if (!resolved.byok && !resolved.isAdmin) {
    const killCheck = await checkKillSwitch('company-enrich');
    if (!killCheck.ok) {
      return err(
        'service_unavailable',
        'Phân tích công ty tạm thời bị tắt do vượt ngưỡng chi phí. Vui lòng thử lại sau hoặc dùng API key riêng.',
        503,
      );
    }
  }

  const company = await getCompany(slug);
  if (!company) {
    return err('not_found', 'Không tìm thấy công ty.', 404);
  }

  // Cache hit short-circuit — caller can pass force=true to bypass.
  if (!body.force && company.enrichment && !isEnrichmentStale(company.enrichment)) {
    return NextResponse.json({ ok: true, company, fromCache: true });
  }

  const result = await enrichCompany(company, {
    llm: { ...body.llm, apiKey: resolved.apiKey },
  });

  if (!result.ok) {
    return err(result.code, result.message, result.status);
  }

  const updated = await mergeEnrichment(slug, result.enrichment);

  // Best-effort cost record — failures here don't block response.
  if (!resolved.byok) {
    try {
      const micro = microUsdCost(
        body.llm.model,
        result.promptTokens ?? 0,
        result.completionTokens ?? 0,
      );
      if (micro > 0) await recordCost('company-enrich', micro);
    } catch {
      /* swallow — cost tracking is best-effort */
    }
  }

  return NextResponse.json({ ok: true, company: updated, fromCache: false });
}
