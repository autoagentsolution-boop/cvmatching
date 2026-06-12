import type { ReactNode } from 'react';
import { getSession } from '@/lib/get-session';
import { AppShell } from '@/features/nav/app-shell';
import { UpgradeLink } from '@/features/nav/upgrade-link';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { isLoginEnabled } from '@/lib/maintenance/login-flag';
import { isInterviewEnabled } from '@/lib/maintenance/interview-flag';

export default async function AppLayout({ children }: { children: ReactNode }) {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // getSession() may throw in dev when AUTH_SECRET is not set — safe to fall back to null
  }

  const isAdmin = isAdminUser(session?.user);
  const [loginEnabled, interviewEnabled] = await Promise.all([
    isLoginEnabled(),
    isInterviewEnabled(),
  ]);

  return (
    <AppShell
      session={session}
      isAdmin={isAdmin}
      loginEnabled={loginEnabled}
      interviewEnabled={interviewEnabled}
      upgradeSlot={<UpgradeLink session={session} />}
    >
      {children}
    </AppShell>
  );
}
