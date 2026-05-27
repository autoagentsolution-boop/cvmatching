import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { env } from '@/lib/env';

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
    }),
  ],
  session: { strategy: 'jwt' },
  secret: env.AUTH_SECRET ?? 'dev-only-secret-replace-via-AUTH_SECRET-env',
  pages: { signIn: '/sign-in' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? user.email ?? '';
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
