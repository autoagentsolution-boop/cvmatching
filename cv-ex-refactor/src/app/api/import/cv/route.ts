// POST /api/import/cv
//
// Accepts a multipart/form-data file upload (PDF, DOCX, TXT).
// Validates MIME via magic bytes, enforces 5 MB cap.
// Returns parsed text (+ metadata). Optionally persists to user_cvs when
// ?saveToLibrary=true and the request is authenticated.
//
// Query params:
//   saveToLibrary  boolean string "true" | "false"
//   name           string   CV label used when saving to library (default: filename)
//
// Response shape:
//   { ok: true, text: string, meta: {...}, savedCvId?: string }

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { detectFileType } from '@/lib/parsers/detect-file-type';
import { parsePdf } from '@/lib/parsers/parse-pdf';
import { parseDocx } from '@/lib/parsers/parse-docx';
import { normalizeText } from '@/lib/parsers/normalize-text';
import { createUserCv } from '@/lib/cvs/repo';

export const runtime = 'nodejs';
export const maxDuration = 15;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

type ErrorCode = 'invalid_input' | 'file_too_large' | 'unsupported_format' | 'parse_failed' | 'unauthorized';

function errRes(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errRes('invalid_input', 'Multipart form data required.', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return errRes('invalid_input', 'Missing "file" field in form data.', 400);
  }
  if (file.size === 0) {
    return errRes('invalid_input', 'File is empty.', 400);
  }
  if (file.size > MAX_BYTES) {
    return errRes('file_too_large', `File too large (limit ${MAX_BYTES / (1024 * 1024)} MB).`, 413);
  }

  const buf = await file.arrayBuffer();
  const kind = detectFileType(buf);

  let raw: string;
  let pages: number | undefined;

  try {
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
      return errRes('unsupported_format', 'Unsupported format. Only PDF, DOCX, and TXT are accepted.', 415);
    }
  } catch (e) {
    console.error('[api/import/cv] parse_failed', {
      kind,
      size: file.size,
      message: e instanceof Error ? e.message : String(e),
    });
    return errRes('parse_failed', 'Could not extract text from file. Please try again.', 500);
  }

  const { text, truncated } = normalizeText(raw);
  if (text.length === 0) {
    return errRes('parse_failed', 'No text content found. The file may be image-only — paste text directly.', 422);
  }

  // Optional: persist to CV library when requested and user is authenticated.
  let savedCvId: string | undefined;
  const saveToLibrary = req.nextUrl.searchParams.get('saveToLibrary') === 'true';

  if (saveToLibrary) {
    const session = await auth();
    if (!session?.user?.id) {
      return errRes('unauthorized', 'Authentication required to save to library.', 401);
    }

    const nameParam = req.nextUrl.searchParams.get('name')?.trim();
    const name = nameParam || file.name.replace(/\.[^.]+$/, '') || 'Imported CV';

    try {
      const cv = await createUserCv(session.user.id, { name, content: text });
      savedCvId = cv.id;
    } catch (e) {
      console.error('[api/import/cv] save_failed', {
        userId: session.user.id,
        message: e instanceof Error ? e.message : String(e),
      });
      return errRes('parse_failed', 'Text extracted but failed to save to library.', 500);
    }
  }

  return NextResponse.json({
    ok: true,
    text,
    meta: { kind, pages, chars: text.length, truncated },
    ...(savedCvId !== undefined ? { savedCvId } : {}),
  });
}
