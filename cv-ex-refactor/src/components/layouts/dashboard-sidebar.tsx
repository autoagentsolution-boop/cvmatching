import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ActiveNav = 'analyze' | 'history' | 'optimizations' | 'career-path';

interface NavItem {
  key: ActiveNav;
  label: string;
  icon: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'analyze', label: 'Analyze', icon: 'analytics', href: '/' },
  { key: 'history', label: 'History', icon: 'history', href: '/history' },
  { key: 'optimizations', label: 'Optimizations', icon: 'auto_fix_high', href: '/optimizations' },
  { key: 'career-path', label: 'Career Path', icon: 'psychology', href: '/career-path' },
];

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: (() => void) | undefined;
}) {
  return (
    <a
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-4 py-3 text-label-md font-medium transition-colors duration-150 active:translate-x-0.5',
        active
          ? 'bg-tertiary-fixed text-on-tertiary-fixed font-bold'
          : 'text-on-surface-variant hover:bg-surface-container-high',
      )}
    >
      <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">
        {item.icon}
      </span>
      {item.label}
    </a>
  );
}

export interface DashboardSidebarProps {
  activeNav: ActiveNav;
  proCtaSlot?: ReactNode;
  onNavClick?: (() => void) | undefined;
}

/** Private sidebar content — consumed by DashboardLayout (desktop) and its mobile Drawer. */
export function DashboardSidebar({ activeNav, proCtaSlot, onNavClick }: DashboardSidebarProps) {
  return (
    <>
      <div className="flex items-center gap-3 px-3 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            auto_fix_high
          </span>
        </div>
        <div>
          <p className="font-display text-headline-md font-bold text-primary">ResumeRefine</p>
          <p className="text-label-sm text-on-primary-container">AI Career Copilot</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.key}
            item={item}
            active={activeNav === item.key}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {proCtaSlot && <div className="px-3 py-4">{proCtaSlot}</div>}

      <div className="border-t border-outline-variant px-3 py-4">
        <a
          href="/help"
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">help</span>
          Help
        </a>
        <a
          href="/api/auth/signout"
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
          Logout
        </a>
      </div>
    </>
  );
}
