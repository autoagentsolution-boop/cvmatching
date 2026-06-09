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
      // Explicit profile mapping — NextAuth v5 beta is generating random
      // UUIDs for user.id under our JWT-only setup, so we anchor user.id to
      // the Google `sub` ourselves at the provider boundary. Belt-and-
      // suspenders: jwt callback also pulls account.providerAccountId.
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
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
    async jwt({ token, user, account, profile }) {
      // user/account/profile are only populated on initial sign-in (fresh
      // OAuth round-trip). Subsequent JWT refreshes pass token through
      // unchanged. So we ONLY reset token.id on actual sign-in events.
      //
      // Priority chain to nail the stable Google `sub`:
      //   1. profile.sub  — raw IdToken claim, most authoritative
      //   2. account.providerAccountId — NextAuth's own mapping of sub
      //   3. user.id  — with profile() override above this should also be sub
      // Whichever wins, log a fingerprint so we can verify in Vercel runtime
      // logs that the same Google account yields the same id across logouts.
      if (user || account || profile) {
        const fromProfile =
          profile && typeof (profile as { sub?: unknown }).sub === 'string'
            ? ((profile as { sub: string }).sub)
            : null;
        const fromAccount = account?.providerAccountId ?? null;
        const fromUser = user?.id ?? null;
        const stableId = fromProfile ?? fromAccount ?? fromUser;

        if (!stableId) {
          console.error('[auth] jwt callback: no stable id from provider', {
            provider: account?.provider ?? null,
            email: user?.email ?? null,
            hasProfile: !!profile,
            hasAccount: !!account,
          });
          throw new Error('Authentication failed: provider returned no stable account id.');
        }

        // Diagnostic: log all three sources so we can confirm Google sub is
        // consistent across sign-in events. Strip nothing — these are not
        // PII in our op logs (admin-only access to Vercel logs).
        console.log('[auth] sign-in id resolution', {
          email: user?.email ?? null,
          fromProfile: fromProfile ?? '(absent)',
          fromAccount: fromAccount ?? '(absent)',
          fromUser: fromUser ?? '(absent)',
          chosen: stableId,
          prevTokenId: typeof token.id === 'string' ? token.id : null,
        });

        token.id = stableId;
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
