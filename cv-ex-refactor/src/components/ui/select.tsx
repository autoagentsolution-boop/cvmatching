'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { MdExpandMore } from 'react-icons/md';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, error = false, className, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'h-12 w-full appearance-none rounded-lg border bg-surface-container-lowest px-4 pr-10',
            'text-body-md text-on-surface',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-4',
            error
              ? 'border-error focus:border-error focus:ring-error/10'
              : 'border-outline-variant focus:border-on-tertiary-container focus:ring-on-tertiary-container/10',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 flex items-center text-on-surface-variant">
          <MdExpandMore size={20} aria-hidden="true" />
        </span>
      </div>
    );
  },
);

Select.displayName = 'Select';
