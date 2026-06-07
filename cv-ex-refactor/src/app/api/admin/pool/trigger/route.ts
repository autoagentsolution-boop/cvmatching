// Admin trigger: dispatches the refresh-jobs.yml GitHub Actions workflow
// without exposing the PAT to clients.
//
// Auth: admin-gated via isAdminUser. Non-admin → 403.
// Token: env.GITHUB_DISPATCH_TOKEN. Fine-grained PAT, scope = Actions
// read+write on this repo only. Token NEVER appears in response bodies
// or logs.
// Idempotent-ish: a second click while a run is queued just enqueues
// another dispatch — GH Actions concurrency settings in the workflow
// (group: refresh-jobs, cancel-in-progress: false) prevent overlap.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { env } from '@/lib/env';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TriggerBodySchema = z
  .object({
    pages: z.coerce.number().int().min(1).max(5).optional(),
    maxAgeDays: z.coerce.number().int().min(1).max(14).optional(),
    topcvSlugs: z.string().max(500).optional(),
  })
  .strict();

function errJson(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!isAdminUser(session?.user)) {
    return errJson('forbidden', 'Admin only.', 403);
  }

  const token = env.GITHUB_DISPATCH_TOKEN;
  const repo = env.GITHUB_REPO ?? 'autoagentsolution-boop/cvmatching';
  if (!token) {
    return errJson(
      'not_configured',
      'GITHUB_DISPATCH_TOKEN chưa được set trên Vercel env. Trong lúc đó: chạy `pnpm run seed-pool` local.',
      503,
    );
  }

  let body: z.infer<typeof TriggerBodySchema> = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      const raw = (await req.json().catch(() => ({}))) as unknown;
      const parsed = TriggerBodySchema.safeParse(raw ?? {});
      if (!parsed.success) {
        return errJson('bad_request', 'Invalid body: ' + parsed.error.message, 400);
      }
      body = parsed.data;
    } catch {
      return errJson('bad_request', 'Invalid JSON body.', 400);
    }
  }

  // Build GH REST dispatch payload. `inputs` keys must match the
  // workflow_dispatch.inputs schema in refresh-jobs.yml.
  const inputs: Record<string, string> = {};
  if (body.pages !== undefined) inputs['pages'] = String(body.pages);
  if (body.maxAgeDays !== undefined) inputs['max_age_days'] = String(body.maxAgeDays);
  if (body.topcvSlugs) inputs['topcv_slugs'] = body.topcvSlugs;

  const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/refresh-jobs.yml/dispatches`;
  let ghStatus: number;
  let ghBodyExcerpt = '';
  try {
    const r = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'cvmatching-admin-trigger',
      },
      body: JSON.stringify({ ref: 'main', inputs }),
    });
    ghStatus = r.status;
    if (ghStatus < 200 || ghStatus >= 300) {
      // Read body but truncate aggressively — never echo PAT contents.
      const text = await r.text().catch(() => '');
      ghBodyExcerpt = text.slice(0, 200).replace(/Bearer \S+/g, 'Bearer ***');
    }
  } catch (err) {
    return errJson(
      'github_unreachable',
      `Không reach được GitHub: ${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`,
      502,
    );
  }

  if (ghStatus === 404) {
    return errJson(
      'workflow_not_found',
      'GH workflow refresh-jobs.yml không tìm thấy hoặc PAT scope không đủ. Verify repo + scope (Actions: read+write).',
      404,
    );
  }
  if (ghStatus === 401 || ghStatus === 403) {
    return errJson(
      'github_unauthorized',
      'PAT không hợp lệ hoặc thiếu scope Actions. Rotate qua: Settings → Developer settings → Fine-grained tokens.',
      ghStatus,
    );
  }
  if (ghStatus !== 204) {
    return errJson(
      'github_error',
      `GH dispatch returned ${ghStatus}: ${ghBodyExcerpt}`,
      502,
    );
  }

  const dispatchedAt = new Date().toISOString();
  const userLabel = session?.user?.email ?? session?.user?.name ?? 'admin';

  // Stamp KV so the page can show "last triggered from UI" without polling
  // GitHub. KV write is best-effort; the dispatch already succeeded.
  if (kvAvailable) {
    try {
      await kv.set(
        'admin:pool:last-dispatch',
        { dispatchedAt, user: userLabel },
        { ex: 60 * 60 * 24 * 30 }, // 30d TTL
      );
    } catch {
      // Non-fatal: dispatch landed, audit stamp is nice-to-have.
    }
  }

  const runsUrl = `https://github.com/${repo}/actions/workflows/refresh-jobs.yml`;
  return NextResponse.json({
    ok: true,
    dispatchedAt,
    runsUrl,
    inputs,
  });
}
