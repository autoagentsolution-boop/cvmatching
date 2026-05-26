import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant">
          {icon}
        </div>
      )}
      <h3 className="font-display text-headline-md text-on-surface">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-body-md text-on-surface-variant">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
