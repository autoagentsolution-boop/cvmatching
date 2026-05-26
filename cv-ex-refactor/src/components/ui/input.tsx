'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, leadingIcon, trailingIcon, className, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 flex items-center text-on-surface-variant">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            'h-12 w-full rounded-lg border bg-surface-container-lowest px-4 text-body-md text-on-surface',
            'placeholder:text-on-surface-variant/60',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-4',
            error
              ? 'border-error focus:border-error focus:ring-error/10'
              : 'border-outline-variant focus:border-on-tertiary-container focus:ring-on-tertiary-container/10',
            disabled && 'cursor-not-allowed opacity-50',
            leadingIcon && 'pl-10',
            trailingIcon && 'pr-10',
            className,
          )}
          {...props}
        />
        {trailingIcon && (
          <span className="absolute right-3 flex items-center text-on-surface-variant">
            {trailingIcon}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
