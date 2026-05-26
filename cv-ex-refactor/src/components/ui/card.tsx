import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps {
  variant?: 'default' | 'interactive' | 'inverse';
  padding?: 'sm' | 'md' | 'lg';
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<CardProps['variant']>, string> = {
  default:
    'bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-soft',
  interactive:
    'bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-soft cursor-pointer transition-all duration-200 hover:shadow-soft-lg hover:-translate-y-0.5',
  inverse:
    'bg-primary-container text-on-primary-container rounded-2xl',
};

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-10',
};

export function Card({
  variant = 'default',
  padding = 'md',
  as: Tag = 'div',
  children,
  className,
}: CardProps) {
  return (
    <Tag className={cn(variantClasses[variant], paddingClasses[padding], className)}>
      {children}
    </Tag>
  );
}
