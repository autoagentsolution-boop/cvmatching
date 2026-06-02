import type { ReactNode } from 'react';
import { getSession } from '@/lib/get-session';
import { AppShell } from '@/features/nav/app-shell';
import { isAdminUser } from '@/lib/usage/admin-auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // getSession() may throw in dev when AUTH_SECRET is not set — safe to fall back to null
  }

  const isAdmin = isAdminUser(session?.user);

  return (
    <AppShell session={session} isAdmin={isAdmin}>
      {children}
    </AppShell>
  );
}
