'use client';

import { cn } from '@/lib/cn';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  description?: string;
  id?: string;
  className?: string;
}

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  description,
  id,
  className,
}: CheckboxProps) {
  const inputId = id ?? `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={cn('flex items-start gap-3 group', className)}>
      <div className="relative flex items-center pt-0.5">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className={cn(
            'h-5 w-5 cursor-pointer appearance-none rounded border-2 border-outline-variant',
            'bg-surface-container-lowest transition-colors duration-150',
            'checked:border-on-tertiary-container checked:bg-on-tertiary-container',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/20',
            'hover:border-on-tertiary-container',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        />
        {checked && (
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-on-tertiary"
            aria-hidden="true"
          >
            <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={inputId}
          className={cn(
            'cursor-pointer text-label-md text-on-surface-variant transition-colors duration-150',
            'group-hover:text-on-surface',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          {label}
        </label>
        {description && (
          <p className="text-label-sm text-on-surface-variant/70">{description}</p>
        )}
      </div>
    </div>
  );
}
