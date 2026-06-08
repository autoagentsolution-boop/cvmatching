import type { NextConfig } from 'next';

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },

  // Static redirects for legacy top-level routes.
  // Routes requiring a dynamic cvId (analyze, jd-matching, career-path,
  // refined-cv, job-fit) are handled by server-component redirect() in the
  // old page files — those need to look up the user's default CV first.
  async redirects() {
    return [
      // /cvs is the canonical library page — no legacy alias needed.
      // Dashboard is handled by root (app)/page.tsx server redirect.
    ];
  },
};

export default nextConfig;
