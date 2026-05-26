'use client';

import { Slot } from '@radix-ui/react-slot';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  asChild?: boolean;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-on-primary shadow-soft hover:opacity-90 active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10',
  secondary:
    'bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10',
  ghost:
    'bg-transparent text-on-surface hover:bg-surface-container-low active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10',
  destructive:
    'bg-error text-on-error hover:opacity-90 active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-error/20',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-4 text-label-md gap-1.5',
  md: 'h-12 px-6 text-label-md gap-2',
  lg: 'h-14 px-8 text-body-md gap-2',
};

const spinnerSizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  type = 'button',
  onClick,
  asChild = false,
  children,
  className,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const sharedClass = cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus-visible:outline-none',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    isDisabled && 'cursor-not-allowed opacity-50',
    className,
  );

  if (asChild) {
    return (
      <Slot
        className={sharedClass}
        onClick={isDisabled ? undefined : onClick}
        aria-busy={loading}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      aria-busy={loading}
      className={sharedClass}
    >
      {loading ? <Spinner className={spinnerSizeClasses[size]} /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}
