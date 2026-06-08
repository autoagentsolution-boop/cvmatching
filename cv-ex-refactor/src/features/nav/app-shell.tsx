'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Session } from 'next-auth';
import { DashboardLayout } from '@/components/layouts';
import type { ActiveNav } from '@/components/layouts/dashboard-sidebar';
import { UserMenu } from './user-menu';
import { VisitsBadge } from './visits-badge';
import { SettingsDrawerTrigger } from '@/features/analyze/settings-drawer-trigger';

interface AppShellProps {
  session: Session | null;
  isAdmin: boolean;
  loginEnabled: boolean;
  children: ReactNode;
  upgradeSlot?: ReactNode;
}

/**
 * Routes that render their own WorkflowLayout (own sidebar + top bar).
 * AppShell must not wrap these in DashboardLayout — that would double-sidebar.
 * /dashboard and /cvs also use a bare layout so they can use WorkflowSidebar
 * in Phase 3+; for now they are plain full-width pages inside DashboardLayout.
 */
function isWorkflowRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/cv-analyze/') ||
    pathname.startsWith('/jd-matching/')
  );
}

function deriveActiveNav(pathname: string): ActiveNav {
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/optimizations')) return 'optimizations';
  if (pathname.startsWith('/career-path')) return 'career-path';
  if (pathname.startsWith('/refined-cv')) return 'refined-cv';
  if (pathname.startsWith('/job-fit')) return 'job-fit';
  if (pathname.startsWith('/admin/maintenance')) return 'admin-maintenance';
  if (pathname.startsWith('/admin/pool')) return 'admin-pool';
  if (pathname.startsWith('/admin/usage')) return 'admin-usage';
  // New workflow routes map to existing nav keys for backward compat
  if (pathname.startsWith('/cv-analyze')) return 'analyze';
  if (pathname.startsWith('/jd-matching')) return 'jd-matching';
  if (pathname.startsWith('/analyze')) return 'analyze';
  return 'dashboard';
}

export function AppShell({ session, isAdmin, loginEnabled, children, upgradeSlot }: AppShellProps) {
  const pathname = usePathname();
  const isAuthed = session !== null;

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
