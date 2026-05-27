import { NextResponse, type NextRequest } from 'next/server';

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

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);
  const headerName =
    process.env.CSP_REPORT_ONLY === '1'
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(headerName, csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(headerName, csp);
  return response;
}

export const config = {
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
