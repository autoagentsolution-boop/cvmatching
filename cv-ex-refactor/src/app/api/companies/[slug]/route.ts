// Public GET endpoint for Company KV records — no auth, no quota.
// Consumed by client-side CompanyCard component on Job Fit detail page.
// Returns 404 when slug not in KV (legacy job without companyId never
// hits here — UI conditionally renders).
//
// Future: Phase 03 will extend response with `ratings`. Phase 05 will
// extend with `enrichment`. Both layered behind the same endpoint to
// keep client logic simple.

import { NextRequest, NextResponse } from 'next/server';
import { getCompany } from '@/lib/companies/kv-client';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;

  if (!slug || slug.length > 80 || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_slug', message: 'Slug không hợp lệ.' } },
      { status: 400 },
    );
  }

  let company;
  try {
    company = await getCompany(slug);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'kv_error',
          message: `Không đọc được Company từ KV: ${e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120)}`,
        },
      },
      { status: 502 },
    );
  }

  if (!company) {
    return NextResponse.json(
      { ok: false, error: { code: 'not_found', message: 'Không tìm thấy thông tin công ty.' } },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { ok: true, company },
    {
      // Edge cache 60s — Company data updates only on ingest / weekly cron;
      // 60s staleness on the read path is acceptable + reduces KV load.
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    },
  );
}
