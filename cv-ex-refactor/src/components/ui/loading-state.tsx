import { cn } from '@/lib/cn';

export interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton';
  message?: string;
  lines?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const spinnerSizeClasses: Record<NonNullable<LoadingStateProps['size']>, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin text-secondary', className)}
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

export function LoadingState({
  variant = 'spinner',
  message,
  lines = 3,
  size = 'md',
  className,
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-label="Loading">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse rounded-lg bg-surface-container-high',
              i === 0 && 'h-5 w-3/4',
              i === 1 && 'h-4 w-full',
              i >= 2 && 'h-4 w-5/6',
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}
      aria-busy="true"
    >
      <SpinnerIcon className={spinnerSizeClasses[size]} />
      {message && (
        <p className="text-body-md text-on-surface-variant">{message}</p>
      )}
    </div>
  );
}
