'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { DashboardSidebar } from './dashboard-sidebar';
import type { ActiveNav } from './dashboard-sidebar';

export interface DashboardLayoutProps {
  activeNav: ActiveNav;
  topnavTitle?: string;
  topnavActions?: ReactNode;
  proCtaSlot?: ReactNode;
  children: ReactNode;
  isAdmin?: boolean;
}

/**
 * DashboardLayout — persistent sidebar + topnav shell for all authed pages.
 *
 * Responsive:
 * - lg+ (≥1024px): sidebar fixed 256px left, topnav 80px, main scrollable.
 * - md/sm (<1024px): sidebar hidden; hamburger opens right Drawer with full nav.
 *
 * proCtaSlot: Phase 1 leave undefined. Phase 2 inject Pro upgrade card.
 * Mobile bottom nav: deferred to Phase 2. Drawer covers full nav on mobile.
 */
export function DashboardLayout({
  activeNav,
  topnavTitle,
  topnavActions,
  proCtaSlot,
  children,
  isAdmin = false,
}: DashboardLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar — hidden below lg */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-outline-variant bg-surface-container-low lg:flex"
        aria-label="Sidebar"
      >
        <DashboardSidebar activeNav={activeNav} proCtaSlot={proCtaSlot} isAdmin={isAdmin} />
      </aside>

      {/* Mobile/tablet drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="right"
        title="Navigation"
      >
        <DashboardSidebar
          activeNav={activeNav}
          proCtaSlot={proCtaSlot}
          isAdmin={isAdmin}
          onNavClick={() => setDrawerOpen(false)}
        />
      </Drawer>

      {/* Content area — offset right of sidebar on desktop */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b border-outline-variant bg-surface/80 px-4 backdrop-blur md:px-10">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open navigation menu"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                menu
              </span>
            </Button>
            {topnavTitle && (
              <h1 className="font-display text-headline-md font-bold text-primary">
                {topnavTitle}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-3">{topnavActions}</div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
