import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';

/**
 * Root route `/` — redirects to /dashboard (authed) or /sign-in (guest).
 * Old DashboardPage content lives at /dashboard; this is now redirect-only.
 */
export default async function RootPage() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // Auth not configured in dev — treat as guest
  }

  if (session?.user?.id) {
    redirect('/dashboard');
  } else {
    redirect('/sign-in');
  }
}
