import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DetailPanelLayoutProps {
  header?: ReactNode;
  children: ReactNode;
  asideSlot: ReactNode;
  asideWidth?: 'sm' | 'md' | 'lg';
  /** Future-proof: Phase 1 supports right side only. */
  asideSide?: 'right';
  className?: string;
}

const asideWidthClasses: Record<NonNullable<DetailPanelLayoutProps['asideWidth']>, string> = {
  sm: 'xl:w-[280px]',
  md: 'xl:w-[320px]',
  lg: 'xl:w-[360px]',
};

/**
 * DetailPanelLayout — main content column + right aside shell.
 * Nested inside DashboardLayout for Results and Refined CV pages.
 *
 * Responsive behavior:
 * - xl+ (≥1280px): two-column flex row — main takes remaining width, aside fixed.
 * - Below xl: aside stacks below main (single column).
 *
 * Aside sticky behavior on desktop: sticks below topnav (top-24 accounts for 80px header + 16px gap).
 *
 * Usage:
 * <DashboardLayout activeNav="analyze">
 *   <DetailPanelLayout
 *     header={<PageHeader title="Results" />}
 *     asideSlot={<MatchScoreBlock />}
 *   >
 *     <OptimizationPathsBlock />
 *   </DetailPanelLayout>
 * </DashboardLayout>
 */
export function DetailPanelLayout({
  header,
  children,
  asideSlot,
  asideWidth = 'md',
  asideSide: _asideSide = 'right',
  className,
}: DetailPanelLayoutProps) {
  return (
    <div className={cn('w-full', className)}>
      {header && <div className="mb-6">{header}</div>}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">{children}</div>

        <aside
          className={cn(
            'w-full shrink-0 xl:sticky xl:top-24 xl:self-start',
            asideWidthClasses[asideWidth],
          )}
        >
          {asideSlot}
        </aside>
      </div>
    </div>
  );
}
