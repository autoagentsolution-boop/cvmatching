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
