import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  helperText,
  required,
  optional,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-label-md text-on-surface-variant">
        {label}
        {required && (
          <span className="ml-0.5 text-error" aria-hidden="true">
            *
          </span>
        )}
        {optional && (
          <span className="ml-1 text-label-sm text-on-surface-variant/60">(optional)</span>
        )}
      </label>

      {children}

      {helperText && !error && (
        <p className="text-label-sm text-on-surface-variant">{helperText}</p>
      )}

      {error && (
        <p className="text-label-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
