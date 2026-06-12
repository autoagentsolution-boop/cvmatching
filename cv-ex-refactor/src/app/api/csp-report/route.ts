import { type NextRequest, NextResponse } from 'next/server';
import { enforceIpRateLimit, rateLimitedResponse } from '@/lib/quota/enforce-ip-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Body cap — typical CSP report payload is < 4 KB; legitimate Reporting-API
// arrays of multiple violations rarely exceed 32 KB. Anything larger is
// almost certainly noise/abuse (a misconfigured client or a log-spam attempt).
const MAX_BODY_BYTES = 32 * 1024;

// IP rate limit — high enough to handle a noisy single browser with several
// violations per page, low enough to make sustained log-spam unattractive.
const RATE_LIMIT_PER_MIN = 30;

const ALLOWED_CONTENT_TYPES = [
  'application/csp-report',
  'application/reports+json',
  'application/json', // some browsers still send plain JSON for legacy report-uri
] as const;

interface LegacyCspReport {
  'csp-report'?: {
    'document-uri'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'blocked-uri'?: string;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
    referrer?: string;
    disposition?: string;
  };
}

interface ReportingApiEntry {
  type?: string;
  url?: string;
  body?: {
    documentURL?: string;
    blockedURL?: string;
    effectiveDirective?: string;
    violatedDirective?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    disposition?: string;
  };
}

function clip(s: string | undefined, n: number): string | undefined {
  if (!s) return undefined;
  return s.length > n ? s.slice(0, n) : s;
}

/**
 * Accepts both legacy `report-uri` POST (`application/csp-report`) and
 * modern Reporting API POST (`application/reports+json`). Logs a single
 * structured line per violation for ingestion via Vercel Logs / log drain.
 * Always returns 204 to avoid retry storms.
 *
 * Hardening (2026-06-12):
 *   - 30 req/min per IP rate limit (Section 5 of external scan flagged
 *     log-spam abuse vector).
 *   - 32 KB body cap to prevent unbounded JSON parse.
 *   - Strict content-type allowlist — anything else → 415.
 *   - Never log User-Agent or full headers; only the violation directive +
 *     blocked URL (already clipped to 300 chars).
 */
export async function POST(req: NextRequest) {
  const rate = await enforceIpRateLimit(req, {
    endpoint: '/api/csp-report',
    max: RATE_LIMIT_PER_MIN,
    windowSec: 60,
  });
  if (!rate.ok) return rateLimitedResponse(rate.retryAfterSec);

  const ct = (req.headers.get('content-type') ?? '').toLowerCase();
  const isAllowed = ALLOWED_CONTENT_TYPES.some((t) => ct.includes(t));
  if (!isAllowed) {
    return new NextResponse(null, { status: 415 });
  }

  // Body size guard — read raw text first, check length, then parse.
  // `req.json()` does not expose a max-size knob, so we go through text.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  try {
    if (ct.includes('application/reports+json')) {
      const body = JSON.parse(raw) as ReportingApiEntry[];
      const list = Array.isArray(body) ? body : [];
      for (const entry of list) {
        if (entry.type && entry.type !== 'csp-violation') continue;
        const b = entry.body ?? {};
        console.warn(
          JSON.stringify({
            event: 'csp_violation',
            source: 'reporting-api',
            documentUrl: clip(b.documentURL, 300),
            blockedUrl: clip(b.blockedURL, 300),
            directive: b.effectiveDirective ?? b.violatedDirective,
            sourceFile: clip(b.sourceFile, 300),
            line: b.lineNumber,
            column: b.columnNumber,
            disposition: b.disposition,
          }),
        );
      }
    } else {
      const body = JSON.parse(raw) as LegacyCspReport;
      const r = body['csp-report'];
      if (r) {
        console.warn(
          JSON.stringify({
            event: 'csp_violation',
            source: 'report-uri',
            documentUrl: clip(r['document-uri'], 300),
            blockedUrl: clip(r['blocked-uri'], 300),
            directive: r['effective-directive'] ?? r['violated-directive'],
            sourceFile: clip(r['source-file'], 300),
            line: r['line-number'],
            column: r['column-number'],
            disposition: r.disposition,
          }),
        );
      }
    }
  } catch (e) {
    console.warn('[csp-report] parse_failed', {
      message: e instanceof Error ? e.message : String(e),
    });
  }

  return new NextResponse(null, { status: 204 });
}
