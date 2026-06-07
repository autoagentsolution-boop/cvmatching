import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ActiveNav =
  | 'dashboard'
  | 'analyze'
  | 'jd-matching'
  | 'refined-cv'
  | 'history'
  | 'optimizations'
  | 'career-path'
  | 'job-fit'
  | 'admin-usage'
  | 'admin-pool'
  | 'admin-maintenance';

interface NavItem {
  key: ActiveNav;
  label: string;
  icon: string;
  href: string;
  /** When true, only renders for admin sessions. */
  adminOnly?: boolean;
}

// Order is the user workflow order — Analyze (start), output pages it feeds,
// then admin-only utilities at the bottom. Sidebar renders flat (no groupings).
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', href: '/' },
  { key: 'analyze', label: 'CV Analyze', icon: 'analytics', href: '/analyze' },
  { key: 'jd-matching', label: 'JD Matching', icon: 'compare_arrows', href: '/jd-matching' },
  { key: 'refined-cv', label: 'Refined CV', icon: 'description', href: '/refined-cv' },
  { key: 'career-path', label: 'Career Path', icon: 'psychology', href: '/career-path' },
  { key: 'history', label: 'History', icon: 'history', href: '/history' },
  { key: 'admin-usage', label: 'Usage', icon: 'analytics', href: '/admin/usage', adminOnly: true },
  { key: 'admin-pool', label: 'Job Pool', icon: 'inventory_2', href: '/admin/pool', adminOnly: true },
  { key: 'admin-maintenance', label: 'Site Controls', icon: 'engineering', href: '/admin/maintenance', adminOnly: true },
  // Job Fit & Study is admin-only during the v0.3 KV-seed pilot.
  { key: 'job-fit', label: 'Job Fit & Study (test)', icon: 'work', href: '/job-fit', adminOnly: true },
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
    <Link
      href={item.href}
      {...(onClick ? { onClick } : {})}
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
    </Link>
  );
}

/** Pro CTA card — visual placeholder for Phase 2 upgrade flow. */
function ProCtaCard() {
  return (
    <div className="mx-3 mb-4 rounded-2xl bg-primary-container p-4">
      <p className="text-label-sm font-bold text-on-primary-container mb-1">
        Reach 10x more interviews with AI.
      </p>
      <p className="text-label-sm text-on-primary-container/70 mb-3">
        Unlock advanced scoring, unlimited analyses, and priority support.
      </p>
      <button
        type="button"
        disabled
        title="Available in Phase 2"
        className={cn(
          'w-full rounded-lg py-2 text-label-md font-bold transition-opacity',
          'bg-on-tertiary-container text-on-tertiary',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}

export interface DashboardSidebarProps {
  activeNav: ActiveNav;
  /** @deprecated Pass nothing — Pro CTA is now always rendered inline. */
  proCtaSlot?: ReactNode;
  onNavClick?: (() => void) | undefined;
  /** When true, the Admin group renders. Derived from session.user.id ∈ ADMIN_USER_IDS. */
  isAdmin?: boolean;
  /** When true, sidebar shows Logout; otherwise shows Sign-in link. */
  isAuthed?: boolean;
}

/** Private sidebar content — consumed by DashboardLayout (desktop) and its mobile Drawer. */
export function DashboardSidebar({
  activeNav,
  onNavClick,
  isAdmin = false,
  isAuthed = false,
}: DashboardSidebarProps) {
  return (
    <>
      <div className="flex items-center gap-3 px-3 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            auto_fix_high
          </span>
        </div>
        <p className="font-display text-headline-md font-bold text-primary">ResumeRefine</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Primary navigation">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
          <NavLink
            key={item.key}
            item={item}
            active={activeNav === item.key}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* Pro CTA — always visible, Phase 2 upgrade affordance */}
      <ProCtaCard />

      <div className="border-t border-outline-variant px-3 py-4">
        <Link
          href="/help"
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">help</span>
          Help
        </Link>
        <Link
          href="/privacy"
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            privacy_tip
          </span>
          Privacy
        </Link>
        {isAuthed && (
          // Logout posts to NextAuth signout endpoint — keep as <a> so it's a real navigation/POST, not client-side route.
          // Guests (isAuthed=false) intentionally get no auth entry while login flow is still gated; flip the
          // Logout/Login pattern back when public sign-in opens.
          <a
            href="/api/auth/signout"
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
            Logout
          </a>
        )}
      </div>
    </>
  );
}
