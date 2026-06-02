import { notFound, redirect } from 'next/navigation';
import { AuthLayout } from '@/components/layouts';
import { Badge } from '@/components/ui';
import { SignInForm } from '@/features/auth/sign-in-form';
import { getSession } from '@/lib/get-session';
import { isLoginEnabled } from '@/lib/maintenance/login-flag';

export default async function SignInPage() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // AUTH_SECRET may not be set in dev — treat as unauthenticated
  }

  if (session) redirect('/');

  // Anyone reaching this code path is a guest (the redirect above caught any
  // authed user). Gate behind the login:enabled KV flag — when off, return
  // notFound() so URL probers see a response identical to a non-existent route.
  // Admin testing flow: toggle the flag ON via /admin/maintenance, sign out,
  // then visit /sign-in to exercise the public OAuth path.
  const enabled = await isLoginEnabled();
  if (!enabled) {
    notFound();
  }

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
