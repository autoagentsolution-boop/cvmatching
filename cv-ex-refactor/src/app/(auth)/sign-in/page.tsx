import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/layouts';
import { Badge } from '@/components/ui';
import { SignInForm } from '@/features/auth/sign-in-form';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { isMaintenanceMode } from '@/lib/maintenance/maintenance-mode';

export default async function SignInPage() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // AUTH_SECRET may not be set in dev — treat as unauthenticated
  }

  // Signed-in users don't need this page. Route them out — but during
  // maintenance the default `/` gets served the 503 page, so an admin
  // ends up trapped (their goal here is usually to flip the maintenance
  // flag off, not visit the dashboard). Send admin straight to the toggle
  // page when maintenance is on; everyone else still goes home.
  if (session) {
    if (isAdminUser(session.user) && (await isMaintenanceMode())) {
      redirect('/admin/maintenance');
    }
    redirect('/');
  }

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
