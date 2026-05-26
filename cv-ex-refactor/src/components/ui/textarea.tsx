'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  /** Visible row count; defaults to 6 */
  rows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, rows = 6, className, disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={cn(
          'w-full resize-y rounded-lg border bg-surface-container-lowest px-4 py-3',
          'text-body-md text-on-surface leading-relaxed',
          'placeholder:text-on-surface-variant/60',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-4',
          error
            ? 'border-error focus:border-error focus:ring-error/10'
            : 'border-outline-variant focus:border-on-tertiary-container focus:ring-on-tertiary-container/10',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
