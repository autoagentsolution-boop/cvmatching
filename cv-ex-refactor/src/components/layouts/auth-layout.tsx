import type { ReactNode } from 'react';

export interface AuthLayoutProps {
  children: ReactNode;
  footerSlot?: ReactNode;
  badgeSlot?: ReactNode;
}

/**
 * AuthLayout — centered card on patterned background.
 * Used by Login and any future auth flows (forgot-password, magic link, etc.).
 *
 * Justification: auth pages have fundamentally different chrome — no sidebar,
 * no topnav, centered card on patterned background. Force-fitting DashboardLayout
 * would require disabling all its slots, which is anti-pattern. See README.md.
 *
 * Atmospheric blur shapes: two decorative blobs (top-left tertiary, bottom-right
 * secondary) matching the Stitch login mockup. pointer-events-none so they never
 * intercept clicks. overflow-hidden on wrapper clips them at viewport edges.
 *
 * badgeSlot: optional fixed bottom-left element (e.g., social proof Badge).
 * Phase 1 callers may leave this empty.
 *
 * RSC-safe — no client interactivity in the shell itself.
 */
export function AuthLayout({ children, footerSlot, badgeSlot }: AuthLayoutProps) {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-surface px-4 py-10 md:px-10"
      style={{
        backgroundImage: 'radial-gradient(var(--color-outline-variant) 0.5px, transparent 0.5px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Atmospheric blur shapes — decorative only */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-[5%] -top-[10%] h-[40%] w-[40%] rounded-full bg-tertiary-fixed opacity-20 blur-[120px]" />
        <div className="absolute -right-[10%] top-[60%] h-[50%] w-[50%] rounded-full bg-secondary-fixed opacity-10 blur-[150px]" />
      </div>

      {/* Centered card area */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[480px] flex-col items-center justify-center gap-6">
        <div className="w-full">{children}</div>

        {footerSlot && (
          <div className="w-full text-center text-label-sm text-outline">
            {footerSlot}
          </div>
        )}
      </div>

      {/* Optional fixed bottom-left badge slot */}
      {badgeSlot && (
        <div className="fixed bottom-10 left-10 z-20 hidden lg:block">
          {badgeSlot}
        </div>
      )}
    </main>
  );
}
