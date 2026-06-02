// Diagnostic endpoint — returns the caller's session shape and admin status.
// Non-admin response is minimal (authed + sanitized user object) to avoid
// leaking env config (admin count, email list). Admin response includes
// matched-by-* flags and env hints for debugging admin-list misconfig.

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { isAdminId, isAdminEmail, isAdminUser } from '@/lib/usage/admin-auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession().catch(() => null);
  const user = session?.user ?? null;
  const isAdmin = isAdminUser(user);

  const base = {
    authed: user !== null,
    user: user
      ? {
          // id intentionally omitted for non-admin response — Google sub is PII-adjacent.
          email: user.email ?? null,
          name: user.name ?? null,
        }
      : null,
    admin: { isAdmin },
  };

  if (!isAdmin) {
    return NextResponse.json(base);
  }

  // Admin-only diagnostic payload — env counts + lowercased email list so the
  // operator can verify ADMIN_USER_EMAILS is set and matches their login.
  return NextResponse.json({
    ...base,
    user: user
      ? {
          id: user.id ?? null,
          email: user.email ?? null,
          name: user.name ?? null,
        }
      : null,
    admin: {
      isAdmin,
      matchedById: isAdminId(user?.id),
      matchedByEmail: isAdminEmail(user?.email),
    },
    envHints: {
      adminIdsCount: (env.ADMIN_USER_IDS ?? '').split(',').filter((s) => s.trim().length > 0).length,
      adminEmailsCount: (env.ADMIN_USER_EMAILS ?? '').split(',').filter((s) => s.trim().length > 0).length,
      adminEmailsLower: (env.ADMIN_USER_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0),
    },
  });
}
