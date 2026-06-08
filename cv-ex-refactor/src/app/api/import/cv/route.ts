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
import { normalizeText } from '@/lib/parsers/normalize-text';
import { createUserCv, ensureUserRow } from '@/lib/cvs/repo';

// IMPORTANT: parse-pdf (unpdf) + parse-docx (mammoth) are dynamic-imported
// inside the branch that needs them. Static imports at route top crash
// module-init at Vercel cold-start → 500 on every request before any code
// in POST runs. See memory feedback_vercel_serverless_jsdom_dynamic_import
// + precedent fix commit ed7319c (jd-import route).

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
  // Persist a stable Buffer copy BEFORE parsing. unpdf / mammoth may detach
  // the underlying ArrayBuffer (transfers to a worker, zero-copy slicing,
  // etc.). After detach any later read — including Buffer.from(buf) for
  // user_cvs.original_bytes — throws "Cannot perform Construct on a
  // detached ArrayBuffer". Copy once up front so storage is independent.
  const originalBuffer = Buffer.from(new Uint8Array(buf));
  const kind = detectFileType(buf);

  let raw: string;
  let pages: number | undefined;

  try {
    if (kind === 'pdf') {
      const { parsePdf } = await import('@/lib/parsers/parse-pdf');
      // Hand the parser a fresh ArrayBuffer slice so the detach can't reach
      // our persistent copy.
      const parseAb = originalBuffer.buffer.slice(
        originalBuffer.byteOffset,
        originalBuffer.byteOffset + originalBuffer.byteLength,
      );
      const r = await parsePdf(parseAb);
      raw = r.text;
      pages = r.pages;
    } else if (kind === 'docx') {
      const { parseDocx } = await import('@/lib/parsers/parse-docx');
      const parseAb = originalBuffer.buffer.slice(
        originalBuffer.byteOffset,
        originalBuffer.byteOffset + originalBuffer.byteLength,
      );
      const r = await parseDocx(parseAb);
      raw = r.text;
    } else if (kind === 'txt') {
      raw = new TextDecoder('utf-8', { fatal: false }).decode(originalBuffer);
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
      // Pass the email so the users row carries it (createUserCv's internal
      // ensureUserRow defaults to null when called via repo directly).
      await ensureUserRow(session.user.id, session.user.email);
      // Persist original bytes + MIME so the Source viewer can render the
      // real PDF/Word (Phase 3 fidelity). MIME comes from detectFileType.
      const mime =
        kind === 'pdf' ? 'application/pdf'
        : kind === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : kind === 'txt' ? 'text/plain'
        : undefined;
      const cv = await createUserCv(session.user.id, {
        name,
        content: text,
        ...(mime ? { originalBytes: originalBuffer, originalMime: mime } : {}),
      });
      savedCvId = cv.id;
    } catch (e) {
      // Drizzle wraps the Postgres error; surface cause + neon-driver fields too.
      const errMessage = e instanceof Error ? e.message : String(e);
      const errCause = e instanceof Error && (e as { cause?: unknown }).cause;
      const causeMessage =
        errCause instanceof Error ? errCause.message : errCause ? String(errCause) : undefined;
      // NeonDbError fields (.code, .detail, .table, .column, .constraint, .severity)
      const driverFields: Record<string, unknown> = {};
      if (typeof e === 'object' && e !== null) {
        for (const k of ['code', 'detail', 'hint', 'table', 'column', 'constraint', 'severity', 'where', 'routine']) {
          const v = (e as Record<string, unknown>)[k];
          if (v !== undefined) driverFields[k] = v;
        }
        const cause = (e as { cause?: unknown }).cause;
        if (cause && typeof cause === 'object') {
          for (const k of ['code', 'detail', 'hint', 'table', 'column', 'constraint', 'severity']) {
            const v = (cause as Record<string, unknown>)[k];
            if (v !== undefined) driverFields[`cause.${k}`] = v;
          }
        }
      }
      console.error('[api/import/cv] save_failed', {
        userId: session.user.id,
        message: errMessage.slice(0, 500),
        causeMessage,
        driverFields,
      });
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'save_failed',
            message: 'Text extracted but failed to save to library.',
            detail: errMessage.slice(0, 500),
            cause: causeMessage,
            driver: driverFields,
          },
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    text,
    meta: { kind, pages, chars: text.length, truncated },
    ...(savedCvId !== undefined ? { savedCvId } : {}),
  });
}
