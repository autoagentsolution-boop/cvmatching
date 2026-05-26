import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, breadcrumb, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 pb-6', className)}>
      {breadcrumb && (
        <div className="mb-1 text-label-sm text-on-surface-variant">{breadcrumb}</div>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-display-lg text-primary tracking-tight truncate md:text-headline-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-body-lg text-on-surface-variant">{subtitle}</p>
          )}
        </div>
        {action && (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        )}
      </div>
    </div>
  );
}
