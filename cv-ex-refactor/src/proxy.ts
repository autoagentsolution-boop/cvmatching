import { NextResponse, type NextRequest } from 'next/server';
import { recordVisit } from '@/lib/analytics/visit-counter';
import { isMaintenanceMode, maintenanceHtml } from '@/lib/maintenance/maintenance-mode';

// Path prefixes that admins (and the maintenance toggle) need accessible
// while the rest of the site is locked down.
const MAINTENANCE_BYPASS_PREFIXES = ['/api/whoami', '/api/health', '/maintenance-ok'];

function shouldBypassMaintenance(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  return MAINTENANCE_BYPASS_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * CSP with per-request nonce + strict-dynamic. Defense-in-depth against XSS,
 * since BYOK API keys live in client memory during a session.
 *
 * Whitelist rationale:
 * - style-src 'unsafe-inline' — Tailwind arbitrary values + Material Symbols
 *   inline overrides. Style-only XSS is low impact vs script XSS.
 * - img-src lh3.googleusercontent.com — NextAuth Google profile pictures.
 * - font-src fonts.gstatic.com — next/font + Material Symbols.
 * - style-src fonts.googleapis.com — Material Symbols stylesheet link.
 * - connect-src 'self' — browser never directly calls LLM providers;
 *   everything goes through /api/*. Server→provider fetch is not browser CSP.
 * - form-action accounts.google.com — Google OAuth redirect.
 *
 * Set CSP_REPORT_ONLY=1 to send Content-Security-Policy-Report-Only instead
 * of enforcing. Useful for staged rollout — deploy report-only first, collect
 * violations, then flip the env var to enforce.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https://lh3.googleusercontent.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self' https://accounts.google.com`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
    `report-uri /api/csp-report`,
  ].join('; ');
}

export async function proxy(request: NextRequest) {
  // Maintenance gate — checked first so a bad render path doesn't bypass it.
  // The KV check is cached 5s per process; cost is sub-ms on the hot path.
  // Whitelist admin diagnostic endpoints so they stay reachable for status.
  if (!shouldBypassMaintenance(request) && (await isMaintenanceMode())) {
    return new NextResponse(maintenanceHtml(), {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '300',
      },
    });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);
  const headerName =
    process.env.CSP_REPORT_ONLY === '1'
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(headerName, csp);

  // Fire-and-forget visit counter — matcher below already excludes /api,
  // /_next, favicon and prefetch requests, so this only fires for real
  // page navigations. Failures are swallowed inside recordVisit.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip')?.trim() ??
    'unknown';
  void recordVisit(ip);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(headerName, csp);
  return response;
}

export const config = {
  // v0.3: /api/jobs, /api/topics, /api/r are already excluded by the /api
  // wildcard in the regex below — visit counter does not fire on job-fit traffic.
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
