import type { ReactNode } from 'react';
import { getSession } from '@/lib/get-session';
import { AppShell } from '@/features/nav/app-shell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // getSession() may throw in dev when AUTH_SECRET is not set — safe to fall back to null
  }

  return <AppShell session={session}>{children}</AppShell>;
}
