import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FormPageLayoutProps {
  header?: ReactNode;
  children: ReactNode;
  actionsSlot?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

/**
 * FormPageLayout — single-column form shell nested inside DashboardLayout.
 *
 * Responsive behavior:
 * - All breakpoints: single column (no multi-column forms in Phase 1).
 * - Max width 920px for comfortable line length on wide screens.
 * - actionsSlot renders sticky at bottom on mobile, inline after content on desktop.
 * - pb-24 on mobile prevents sticky action bar from overlapping last form field.
 *
 * Usage:
 * <DashboardLayout activeNav="analyze">
 *   <FormPageLayout
 *     header={<PageHeader title="..." />}
 *     actionsSlot={<Button variant="primary">Analyze & Score</Button>}
 *     meta={<p>Estimated: 4–6 seconds</p>}
 *   >
 *     <CvInputBlock />
 *     <JdInputBlock />
 *   </FormPageLayout>
 * </DashboardLayout>
 */
export function FormPageLayout({
  header,
  children,
  actionsSlot,
  meta,
  className,
}: FormPageLayoutProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[920px]', className)}>
      {header && <div className="mb-6">{header}</div>}

      <div className="space-y-6 pb-24 md:pb-8">
        {children}
      </div>

      {actionsSlot && (
        <>
          {/* Mobile: sticky bar anchored at viewport bottom */}
          <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-outline-variant bg-surface/90 px-4 py-4 backdrop-blur md:hidden">
            {actionsSlot}
            {meta && (
              <div className="mt-2 text-center text-label-sm text-on-surface-variant">
                {meta}
              </div>
            )}
          </div>

          {/* Desktop: inline after content */}
          <div className="hidden md:block mt-2 pt-6 border-t border-outline-variant">
            <div className="flex flex-col items-start gap-2">
              {actionsSlot}
              {meta && (
                <p className="text-label-sm text-on-surface-variant">{meta}</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Meta shown standalone when no actionsSlot */}
      {!actionsSlot && meta && (
        <div className="mt-4 text-label-sm text-on-surface-variant">{meta}</div>
      )}
    </div>
  );
}
