'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Session } from 'next-auth';
import { DashboardLayout } from '@/components/layouts';
import type { ActiveNav } from '@/components/layouts/dashboard-sidebar';
import { UserMenu } from './user-menu';
import { VisitsBadge } from './visits-badge';
import { SettingsDrawerTrigger } from '@/features/analyze/settings-drawer-trigger';
import { useUserIdGuard } from '@/features/auth/use-user-id-guard';

interface AppShellProps {
  session: Session | null;
  isAdmin: boolean;
  loginEnabled: boolean;
  interviewEnabled: boolean;
  children: ReactNode;
  upgradeSlot?: ReactNode;
}

/**
 * Routes that render their own WorkflowLayout (own topbar + chevron + 2-col).
 * AppShell must not wrap these in DashboardLayout or we'd double-render the
 * sidebar shell. WorkflowLayout reuses DashboardSidebar internally so the
 * nav itself stays identical across all routes.
 */
function isWorkflowRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/cv-analyze/') ||
    pathname.startsWith('/jd-matching/')
  );
}

function deriveActiveNav(pathname: string): ActiveNav {
  if (pathname.startsWith('/cvs')) return 'cvs';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/admin/maintenance')) return 'admin-maintenance';
  if (pathname.startsWith('/admin/pool')) return 'admin-pool';
  if (pathname.startsWith('/admin/usage')) return 'admin-usage';
  if (pathname.startsWith('/interview')) return 'interview';
  // Workflow detail routes highlight their entry-workflow nav item.
  if (pathname.startsWith('/cv-analyze')) return 'analyze';
  if (pathname.startsWith('/jd-matching')) return 'jd-matching';
  if (pathname.startsWith('/analyze')) return 'analyze';
  return 'dashboard';
}

export function AppShell({ session, isAdmin, loginEnabled, interviewEnabled, children, upgradeSlot }: AppShellProps) {
  const pathname = usePathname();
  const isAuthed = session !== null;

  // Purge per-user client caches when the signed-in identity changes (A→B,
  // A→null, or null→B after a prior session) so user B never sees user A's
  // CV / JD / analyze results on a shared browser.
  useUserIdGuard(session?.user?.id ?? null);

  // Workflow pages own their own shell — render children bare.
  if (isWorkflowRoute(pathname)) {
    return <>{children}</>;
  }

  const activeNav = deriveActiveNav(pathname);

  return (
    <DashboardLayout
      activeNav={activeNav}
      isAdmin={isAdmin}
      isAuthed={isAuthed}
      interviewEnabled={interviewEnabled}
      topnavActions={
        <>
          {upgradeSlot}
          <VisitsBadge />
          <SettingsDrawerTrigger isAuthed={isAuthed} />
          <UserMenu user={session?.user ?? null} loginEnabled={loginEnabled || isAdmin} />
        </>
      }
    >
      {children}
    </DashboardLayout>
  );
}
