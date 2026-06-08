import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/layouts';
import { Badge } from '@/components/ui';
import { SignInForm } from '@/features/auth/sign-in-form';
import { getSession } from '@/lib/get-session';

export default async function SignInPage() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // AUTH_SECRET may not be set in dev — treat as unauthenticated
  }

  if (session) redirect('/');

  // Page is publicly reachable so a signed-out admin can still OAuth back in.
  // The actual login:enabled gate moved to the NextAuth signIn callback:
  // non-admin emails are rejected post-OAuth when the flag is off. Net effect:
  //   - normal user → Google login → callback rejects → bounced to /sign-in
  //   - admin user  → Google login → callback allows → in
  // Trade-off vs prior notFound(): /sign-in now reveals it exists, but OAuth
  // is the real security boundary so nothing exploitable is leaked.
  return (
    <AuthLayout
      badgeSlot={
        <Badge variant="success" size="md">
          94% Success Rate
        </Badge>
      }
      footerSlot={
        <p>
          <a href="#" className="hover:underline">
            Terms
          </a>
          <span className="mx-2">·</span>
          <a href="#" className="hover:underline">
            Privacy
          </a>
        </p>
      }
    >
      <SignInForm />
    </AuthLayout>
  );
}
