import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateUrl } from '@/lib/scrape/validate-url';
import { fetchHtml } from '@/lib/scrape/fetch-html';
import { detectAntibot } from '@/lib/scrape/detect-antibot';
import { extractReadability } from '@/lib/scrape/extract-readability';
import { normalizeText } from '@/lib/parsers/normalize-text';
import { enforceIpRateLimit, rateLimitedResponse } from '@/lib/quota/enforce-ip-rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 10;

const Body = z.object({ url: z.string().min(1).max(2048) });

type ErrorCode = 'invalid_input' | 'scrape_failed' | 'network_failed';

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const rate = await enforceIpRateLimit(req, { endpoint: '/api/scrape', max: 30, windowSec: 60 });
  if (!rate.ok) return rateLimitedResponse(rate.retryAfterSec);

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return errorResponse('invalid_input', 'Body phải có field "url" hợp lệ.', 400);
  }

  const validation = await validateUrl(parsed.data.url);
  if (!validation.ok) {
    return errorResponse('invalid_input', validation.reason, 400);
  }

  try {
    const { html, finalUrl } = await fetchHtml(validation.url);

    if (detectAntibot(html)) {
      return errorResponse(
        'scrape_failed',
        'Trang có anti-bot/JS-only. Vui lòng dán nội dung JD trực tiếp.',
        422,
      );
    }

    const article = extractReadability(html, finalUrl);
    if (!article || article.text.length < 200) {
      return errorResponse(
        'scrape_failed',
        'Không trích được nội dung chính. Vui lòng dán nội dung JD trực tiếp.',
        422,
      );
    }

    const { text, truncated } = normalizeText(article.text);

    return NextResponse.json({
      ok: true,
      title: article.title,
      text,
      site: article.siteName ?? new URL(finalUrl).hostname,
      byline: article.byline,
      length: text.length,
      truncated,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/scrape] failed', {
      host: validation.url.hostname,
      message: msg.slice(0, 200),
    });
    const isAbort = msg.toLowerCase().includes('abort') || msg.includes('timeout');
    return errorResponse(
      isAbort ? 'network_failed' : 'scrape_failed',
      isAbort ? 'Trang phản hồi quá chậm (>8s).' : 'Lỗi khi lấy nội dung.',
      isAbort ? 504 : 502,
    );
  }
}
