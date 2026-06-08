import Link from 'next/link';
import { cn } from '@/lib/cn';

export type WorkflowNavKey =
  | 'dashboard'
  | 'cvs'
  | 'cv-analyze'
  | 'jd-matching'
  | 'history'
  | 'admin-usage'
  | 'admin-pool'
  | 'admin-maintenance';

interface WorkflowNavItem {
  key: WorkflowNavKey;
  label: string;
  icon: string;
  href: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: WorkflowNavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', href: '/dashboard' },
  { key: 'cvs', label: 'My CVs', icon: 'description', href: '/cvs' },
  { key: 'cv-analyze', label: 'CV Analyze', icon: 'analytics', href: '/analyze' },
  { key: 'jd-matching', label: 'JD Matching', icon: 'compare_arrows', href: '/jd-matching' },
  // History exposes the legacy v0.3 standalone surface — hidden from normal
  // users (sub-steps inside each workflow cover the same ground). Admin sees
  // it for QA against the cached analysis log.
  { key: 'history', label: 'History', icon: 'history', href: '/history', adminOnly: true },
  { key: 'admin-usage', label: 'Usage', icon: 'bar_chart', href: '/admin/usage', adminOnly: true },
  { key: 'admin-pool', label: 'Job Pool', icon: 'inventory_2', href: '/admin/pool', adminOnly: true },
  { key: 'admin-maintenance', label: 'Site Controls', icon: 'engineering', href: '/admin/maintenance', adminOnly: true },
];

export interface WorkflowSidebarProps {
  activeNav: WorkflowNavKey;
  isAdmin?: boolean;
  isAuthed?: boolean;
}

/**
 * WorkflowSidebar — ~60px wide icon-only sidebar for workflow pages.
 * Shows icon + tooltip on hover. Logout at bottom when authed.
 */
export function WorkflowSidebar({
  activeNav,
  isAdmin = false,
  isAuthed = false,
}: WorkflowSidebarProps) {
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 flex w-[60px] flex-col border-r border-outline-variant bg-surface-container-low"
      aria-label="Workflow navigation"
    >
      {/* Logo icon */}
      <div className="flex h-14 items-center justify-center border-b border-outline-variant">
        <Link
          href="/dashboard"
          title="Resume Refactor"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            auto_fix_high
          </span>
        </Link>
      </div>

      {/* Nav icons */}
      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3" aria-label="Primary navigation">
        {visibleItems.map((item) => {
          const isActive = activeNav === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isActive
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high',
              )}
            >
              <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">
                {item.icon}
              </span>

              {/* Tooltip */}
              <span
                className={cn(
                  'pointer-events-none absolute left-full ml-2 z-50',
                  'rounded-md bg-inverse-surface px-2.5 py-1 text-label-sm text-inverse-on-surface',
                  'whitespace-nowrap opacity-0 transition-opacity duration-150',
                  'group-hover:opacity-100 group-focus-visible:opacity-100',
                )}
                role="tooltip"
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: sign-out */}
      {isAuthed && (
        <div className="flex flex-col items-center gap-1 border-t border-outline-variant py-3">
          <a
            href="/api/auth/signout"
            title="Sign out"
            aria-label="Sign out"
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">
              logout
            </span>
            <span
              className="pointer-events-none absolute left-full ml-2 z-50 rounded-md bg-inverse-surface px-2.5 py-1 text-label-sm text-inverse-on-surface whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              role="tooltip"
            >
              Sign out
            </span>
          </a>
        </div>
      )}
    </aside>
  );
}
