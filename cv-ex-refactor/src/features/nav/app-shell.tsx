'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Session } from 'next-auth';
import { DashboardLayout } from '@/components/layouts';
import type { ActiveNav } from '@/components/layouts/dashboard-sidebar';
import { UserMenu } from './user-menu';
import { SettingsDrawerTrigger } from '@/features/analyze/settings-drawer-trigger';

interface AppShellProps {
  session: Session | null;
  children: ReactNode;
}

function deriveActiveNav(pathname: string): ActiveNav {
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/optimizations')) return 'optimizations';
  if (pathname.startsWith('/career-path')) return 'career-path';
  return 'analyze';
}

export function AppShell({ session, children }: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeNav = deriveActiveNav(pathname);
  const isAuthed = session !== null;
  const defaultByok = searchParams.get('mode') === 'byok';

  return (
    <DashboardLayout
      activeNav={activeNav}
      topnavActions={
        <>
          <SettingsDrawerTrigger isAuthed={isAuthed} defaultOpen={defaultByok} />
          <UserMenu user={session?.user ?? null} />
        </>
      }
    >
      {children}
    </DashboardLayout>
  );
}
