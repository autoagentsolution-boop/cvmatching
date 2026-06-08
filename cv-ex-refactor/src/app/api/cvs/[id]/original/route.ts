// GET /api/cvs/[id]/original
//
// Stream the original uploaded CV bytes with the stored MIME so the Source
// Document viewer can render the real PDF / DOCX / TXT (vs. parsed-text
// approximation). Auth-gated + ownership-checked.
//
// Returns 404 (not 403) when ownership fails — matches the rest of /api/cvs
// for no-info-leak.

import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getUserCvOriginal } from '@/lib/cvs/repo';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: { code: 'unauthorized' } }, { status: 401 });
  }

  const { id } = await ctx.params;
  const result = await getUserCvOriginal(session.user.id, id);
  if (!result) {
    // Missing row, wrong owner, OR legacy CV without original bytes.
    return NextResponse.json({ ok: false, error: { code: 'not_found' } }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      'Content-Type': result.mime,
      // Inline so the browser embeds (PDF) instead of downloading.
      'Content-Disposition': 'inline',
      // Caching: bytes are immutable per CV id (re-upload would be a new id),
      // but the CV row itself is mutable (rename), so leave private + short.
      'Cache-Control': 'private, max-age=60',
      // Explicit SAMEORIGIN so the response can be embedded in our own page
      // (Vercel platform may otherwise default to DENY on API routes which
      // surfaces as "refused to connect" inside <iframe>/<embed>).
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
