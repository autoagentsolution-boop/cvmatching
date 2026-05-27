import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
 */
export async function POST(req: NextRequest) {
  try {
    const ua = clip(req.headers.get('user-agent') ?? undefined, 200);
    const ct = req.headers.get('content-type') ?? '';

    if (ct.includes('application/reports+json')) {
      const body = (await req.json()) as ReportingApiEntry[];
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
            ua,
          }),
        );
      }
    } else {
      const body = (await req.json()) as LegacyCspReport;
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
            ua,
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
