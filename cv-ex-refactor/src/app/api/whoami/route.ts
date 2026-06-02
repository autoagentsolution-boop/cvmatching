// Diagnostic endpoint — returns the caller's session shape and admin status.
// No secrets exposed. Useful for debugging "why doesn't the Admin sidebar show?"
// without needing Vercel logs.

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { isAdminId, isAdminEmail, isAdminUser } from '@/lib/usage/admin-auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession().catch(() => null);
  const user = session?.user ?? null;

  return NextResponse.json({
    authed: user !== null,
    user: user
      ? {
          id: user.id ?? null,
          email: user.email ?? null,
          name: user.name ?? null,
        }
      : null,
    admin: {
      isAdmin: isAdminUser(user),
      matchedById: isAdminId(user?.id),
      matchedByEmail: isAdminEmail(user?.email),
    },
    envHints: {
      // Only show non-secret meta: counts and lowercase preview.
      adminIdsCount: (env.ADMIN_USER_IDS ?? '').split(',').filter((s) => s.trim().length > 0).length,
      adminEmailsCount: (env.ADMIN_USER_EMAILS ?? '').split(',').filter((s) => s.trim().length > 0).length,
      adminEmailsLower: (env.ADMIN_USER_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0),
    },
  });
}
