import { NextRequest, NextResponse } from 'next/server';
import { detectFileType } from '@/lib/parsers/detect-file-type';
import { parsePdf } from '@/lib/parsers/parse-pdf';
import { parseDocx } from '@/lib/parsers/parse-docx';
import { normalizeText } from '@/lib/parsers/normalize-text';
import { enforceIpRateLimit, rateLimitedResponse } from '@/lib/quota/enforce-ip-rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 10;

const MAX_BYTES = 4 * 1024 * 1024;

type ErrorCode =
  | 'invalid_input'
  | 'file_too_large'
  | 'unsupported_format'
  | 'parse_failed';

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const rate = await enforceIpRateLimit(req, { endpoint: '/api/parse', max: 30, windowSec: 60 });
  if (!rate.ok) return rateLimitedResponse(rate.retryAfterSec);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse('invalid_input', 'Yêu cầu không hợp lệ (multipart required).', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return errorResponse('invalid_input', 'Thiếu file trong form-data (field "file").', 400);
  }
  if (file.size === 0) {
    return errorResponse('invalid_input', 'File rỗng.', 400);
  }
  if (file.size > MAX_BYTES) {
    return errorResponse(
      'file_too_large',
      `File quá lớn (giới hạn ${MAX_BYTES / (1024 * 1024)}MB).`,
      413,
    );
  }

  const buf = await file.arrayBuffer();
  const kind = detectFileType(buf);

  try {
    let raw: string;
    let pages: number | undefined;

    if (kind === 'pdf') {
      const r = await parsePdf(buf);
      raw = r.text;
      pages = r.pages;
    } else if (kind === 'docx') {
      const r = await parseDocx(buf);
      raw = r.text;
    } else if (kind === 'txt') {
      raw = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    } else {
      return errorResponse(
        'unsupported_format',
        'Định dạng không hỗ trợ. Chỉ chấp nhận PDF, DOCX, TXT.',
        415,
      );
    }

    const { text, truncated } = normalizeText(raw);

    if (text.length === 0) {
      return errorResponse(
        'parse_failed',
        'Không trích xuất được nội dung. File có thể là scan/ảnh — vui lòng dán văn bản trực tiếp.',
        422,
      );
    }

    return NextResponse.json({
      ok: true,
      text,
      meta: { kind, pages, chars: text.length, truncated },
    });
  } catch (e) {
    console.error('[api/parse] parse_failed', {
      kind,
      size: file.size,
      message: e instanceof Error ? e.message : String(e),
    });
    return errorResponse('parse_failed', 'Không thể parse file. Vui lòng thử lại.', 500);
  }
}
