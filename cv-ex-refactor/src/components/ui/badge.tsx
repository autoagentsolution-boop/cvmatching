import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'secondary';
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-secondary-fixed text-on-secondary-fixed',
  warning: 'bg-tertiary-fixed text-on-tertiary-fixed',
  error: 'bg-error-container text-on-error-container',
  info: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  neutral: 'bg-surface-container-highest text-on-surface-variant',
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-secondary-container text-on-secondary-container',
};

const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-label-sm',
  md: 'px-3 py-1 text-label-sm',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-bold',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
