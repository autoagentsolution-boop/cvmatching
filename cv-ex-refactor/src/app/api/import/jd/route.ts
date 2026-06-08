// POST /api/import/jd
//
// Three input modes (mutually exclusive, checked in order):
//   1. multipart/form-data  — file field "file" (PDF / DOCX / TXT)
//   2. JSON { url: string } — fetch + scrape via scrapeJdFromUrl
//   3. JSON { text: string } — pass-through, normalize only
//
// NOT auth-gated — JDs are not user-owned, ephemeral per request.
//
// Response: { ok: true, text: string, title?: string, source?: string }

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { detectFileType } from '@/lib/parsers/detect-file-type';
import { parsePdf } from '@/lib/parsers/parse-pdf';
import { parseDocx } from '@/lib/parsers/parse-docx';
import { normalizeText } from '@/lib/parsers/normalize-text';
import { scrapeJdFromUrl } from '@/lib/jd-import/scrape-jd-from-url';

export const runtime = 'nodejs';
export const maxDuration = 20; // URL scraping can take ~8s + parse

const MAX_BYTES = 5 * 1024 * 1024;

type ErrorCode =
  | 'invalid_input'
  | 'file_too_large'
  | 'unsupported_format'
  | 'parse_failed'
  | 'fetch_failed';

function errRes(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

const UrlBody = z.object({ url: z.string().url().max(2048) });
const TextBody = z.object({ text: z.string().min(1).max(50_000) });

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';

  // ── Mode 1: file upload ───────────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
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
    if (file.size === 0) return errRes('invalid_input', 'File is empty.', 400);
    if (file.size > MAX_BYTES) {
      return errRes('file_too_large', `File too large (limit ${MAX_BYTES / (1024 * 1024)} MB).`, 413);
    }

    const buf = await file.arrayBuffer();
    const kind = detectFileType(buf);
    let raw: string;

    try {
      if (kind === 'pdf') {
        raw = (await parsePdf(buf)).text;
      } else if (kind === 'docx') {
        raw = (await parseDocx(buf)).text;
      } else if (kind === 'txt') {
        raw = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      } else {
        return errRes('unsupported_format', 'Unsupported format. Only PDF, DOCX, and TXT are accepted.', 415);
      }
    } catch (e) {
      console.error('[api/import/jd] file_parse_failed', {
        kind,
        message: e instanceof Error ? e.message : String(e),
      });
      return errRes('parse_failed', 'Could not extract text from file.', 500);
    }

    const { text, truncated } = normalizeText(raw);
    if (text.length === 0) {
      return errRes('parse_failed', 'No text content found in file.', 422);
    }

    return NextResponse.json({ ok: true, text, meta: { kind, chars: text.length, truncated } });
  }

  // ── Modes 2 & 3: JSON body ────────────────────────────────────────────
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return errRes('invalid_input', 'Request body must be valid JSON or multipart form data.', 400);
  }

  // Mode 2: URL scrape
  const urlParsed = UrlBody.safeParse(json);
  if (urlParsed.success) {
    try {
      const scraped = await scrapeJdFromUrl(urlParsed.data.url);
      const { text, truncated } = normalizeText(scraped.description);
      if (text.length === 0) {
        return errRes('parse_failed', 'No job description content found at URL.', 422);
      }
      return NextResponse.json({
        ok: true,
        text,
        meta: { chars: text.length, truncated },
        ...(scraped.title ? { title: scraped.title } : {}),
        ...(scraped.source ? { source: scraped.source } : {}),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[api/import/jd] url_scrape_failed', { url: urlParsed.data.url, message: msg });
      return errRes('fetch_failed', msg, 422);
    }
  }

  // Mode 3: raw text pass-through
  const textParsed = TextBody.safeParse(json);
  if (textParsed.success) {
    const { text, truncated } = normalizeText(textParsed.data.text);
    if (text.length === 0) {
      return errRes('invalid_input', 'Text content is empty after normalization.', 400);
    }
    return NextResponse.json({ ok: true, text, meta: { chars: text.length, truncated } });
  }

  // Neither shape matched
  return errRes(
    'invalid_input',
    'Body must be one of: { url } | { text } | multipart file upload.',
    400,
  );
}
