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
  children: ReactNode;
}

function deriveActiveNav(pathname: string): ActiveNav {
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/optimizations')) return 'optimizations';
  if (pathname.startsWith('/career-path')) return 'career-path';
  if (pathname.startsWith('/refined-cv')) return 'refined-cv';
  if (pathname.startsWith('/job-fit')) return 'job-fit';
  return 'analyze';
}

export function AppShell({ session, children }: AppShellProps) {
  const pathname = usePathname();
  const activeNav = deriveActiveNav(pathname);
  const isAuthed = session !== null;

  return (
    <DashboardLayout
      activeNav={activeNav}
      topnavActions={
        <>
          <VisitsBadge />
          <SettingsDrawerTrigger isAuthed={isAuthed} />
          <UserMenu user={session?.user ?? null} />
        </>
      }
    >
      {children}
    </DashboardLayout>
  );
}
