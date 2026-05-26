'use client';

import type { ReactNode } from 'react';
import { MdErrorOutline } from 'react-icons/md';
import { cn } from '@/lib/cn';

export interface ErrorStateProps {
  title: string;
  description?: string;
  retry?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function ErrorState({ title, description, retry, icon, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border border-error-container bg-error-container/40 px-8 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-on-error-container">
        {icon ?? <MdErrorOutline size={28} aria-hidden="true" />}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-headline-md text-on-surface">{title}</h3>
        {description && (
          <p className="max-w-sm text-body-md text-on-surface-variant">{description}</p>
        )}
      </div>
      {retry && (
        <button
          onClick={retry}
          className="mt-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-6 py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40"
        >
          Try again
        </button>
      )}
    </div>
  );
}
