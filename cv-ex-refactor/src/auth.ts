import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { env } from '@/lib/env';
import { isAdminEmail, isAdminId } from '@/lib/usage/admin-auth';
import { isLoginEnabled } from '@/lib/maintenance/login-flag';

const isProduction = process.env.NODE_ENV === 'production';
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

if (isProduction && !isBuildPhase && !env.AUTH_SECRET) {
  // Loud failure at runtime startup; build phase skips so deploy artifacts can
  // be produced before runtime env vars are injected by the platform.
  throw new Error('AUTH_SECRET is required in production. Generate via `openssl rand -base64 32`.');
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
      // Force Google to show the account chooser + re-auth screen on every
      // sign-in. `consent` re-prompts consent (covers fresh-scope changes);
      // `select_account` shows the account picker even when one Google session
      // is already active. Combined value 'consent select_account' is the
      // most reliable way to switch accounts during admin setup.
      authorization: { params: { prompt: 'consent select_account' } },
    }),
  ],
  session: { strategy: 'jwt' },
  secret: env.AUTH_SECRET ?? 'dev-only-secret-replace-via-AUTH_SECRET-env',
  pages: { signIn: '/sign-in' },
  callbacks: {
    // Gate: when public login is disabled (KV `login:enabled` flag off), only
    // admin emails/IDs may complete sign-in. Returning false here cancels the
    // OAuth flow — NextAuth bounces user back to /sign-in with ?error.
    // Admin always allowed regardless of flag so operator can recover the site
    // from a fully-locked state without poking KV directly.
    async signIn({ user }) {
      const adminBypass = isAdminId(user.id) || isAdminEmail(user.email);
      if (adminBypass) return true;
      try {
        return await isLoginEnabled();
      } catch {
        // Fail-closed: KV error during sign-in must reject non-admins to keep
        // the lockdown invariant. Admin already short-circuited above.
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        // user.id should be the Google `sub` (stable, account-unique). If it
        // is missing we MUST NOT fall back to email — different OAuth flows
        // can yield different shapes for the email, and persisting CVs to a
        // userId that later changes silently orphans the rows (looks like
        // "CVs disappeared after relogin"). Surface as an explicit failure
        // so we never write to user_cvs with an unstable key.
        if (!user.id) {
          console.error('[auth] jwt callback received user without id', {
            email: user.email ?? null,
            name: user.name ?? null,
          });
          throw new Error('Authentication failed: provider did not return a stable user id.');
        }
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = String(token.id);
      }
      return session;
    },
  },
});
