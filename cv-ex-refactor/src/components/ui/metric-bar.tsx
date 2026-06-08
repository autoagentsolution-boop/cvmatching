'use client';

import { cn } from '@/lib/cn';

export interface MetricBarProps {
  label: string;
  /** 0-100. */
  value: number;
  /** Optional reason / context text under the bar. */
  reason?: string;
  /** Color hint — 'role' = primary, 'experience' = tertiary, 'keyword' = secondary, default neutral. */
  accent?: 'role' | 'experience' | 'keyword' | 'neutral';
  /** Optional right-side suffix (e.g. evidence count badge). */
  suffix?: React.ReactNode;
  className?: string;
}

const ACCENT_FILL: Record<NonNullable<MetricBarProps['accent']>, string> = {
  role: 'bg-primary',
  experience: 'bg-tertiary',
  keyword: 'bg-secondary',
  neutral: 'bg-on-surface-variant',
};

/**
 * Horizontal labeled progress bar — the role-fit-metric atom.
 * Reused for the 9-dim deep dive too (just pass accent='neutral').
 */
export function MetricBar({
  label,
  value,
  reason,
  accent = 'neutral',
  suffix,
  className,
}: MetricBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-label-md font-medium text-on-surface">{label}</span>
        <span className="flex items-center gap-2 text-label-md tabular-nums text-on-surface-variant">
          {suffix}
          <span className="font-semibold text-on-surface">{clamped}%</span>
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-container"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', ACCENT_FILL[accent])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {reason && (
        <p className="mt-0.5 text-body-sm text-on-surface-variant leading-snug line-clamp-2">{reason}</p>
      )}
    </div>
  );
}
