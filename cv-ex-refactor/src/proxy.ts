import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { recordVisit } from '@/lib/analytics/visit-counter';
import { isMaintenanceMode, maintenanceHtml } from '@/lib/maintenance/maintenance-mode';
import { isAdminId, isAdminEmail } from '@/lib/usage/admin-auth';

// Path prefixes that stay accessible during maintenance mode.
// - whoami / health: ops diagnostics
// - maintenance-ok: signal that the toggle UI is healthy
// - sign-in + /api/auth: admin must be able to OAuth back in even when the
//   site is locked down. The NextAuth signIn callback (see auth.ts) gates
//   per identity post-OAuth, so non-admin users hitting these paths still
//   cannot complete auth — they bounce with ?error=AccessDenied.
const MAINTENANCE_BYPASS_PREFIXES = [
  '/api/whoami',
  '/api/health',
  '/maintenance-ok',
  '/sign-in',
  '/api/auth',
];

function shouldBypassMaintenance(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  return MAINTENANCE_BYPASS_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Decode the NextAuth JWT from the request cookies and check admin membership.
 * Strategy='jwt' in auth.ts means we never hit the DB — getToken decrypts the
 * cookie in-process. AUTH_SECRET is required to decrypt; in dev without it,
 * everyone is treated as non-admin (fail-closed for the bypass path).
 */
async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    const token = await getToken({ req: request, secret });
    if (!token) return false;
    const id = typeof token.id === 'string' ? token.id : null;
    const email = typeof token.email === 'string' ? token.email : null;
    return isAdminId(id) || isAdminEmail(email);
  } catch {
    return false;
  }
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
  // Bypass: whitelisted diagnostic endpoints OR an authenticated admin (so
  // operator can verify state + flip the toggle off without poking CLI).
  if (!shouldBypassMaintenance(request) && (await isMaintenanceMode())) {
    const isAdmin = await isAdminRequest(request);
    if (!isAdmin) {
      return new NextResponse(maintenanceHtml(), {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': '300',
        },
      });
    }
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
  // Light JWT decode to flag authed visits — Q3 funnel tracking. AUTH_SECRET
  // missing in dev → treated as anonymous (fail-closed).
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip')?.trim() ??
    'unknown';
  const authSecret = process.env.AUTH_SECRET;
  const isAuthed = authSecret
    ? !!(await getToken({ req: request, secret: authSecret }).catch(() => null))
    : false;
  void recordVisit(ip, isAuthed);

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
