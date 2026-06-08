'use client';

import { MdWarningAmber, MdErrorOutline, MdInfoOutline, MdArrowForward } from 'react-icons/md';
import { cn } from '@/lib/cn';
import type { Severity } from '@/features/analyze/types';

export interface CriticalRefactorItem {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  /** Optional CTA — when omitted, no button rendered. */
  ctaLabel?: string;
  onCta?: () => void;
}

export interface CriticalRefactorListProps {
  items: CriticalRefactorItem[];
  heading?: string;
  emptyMessage?: string;
  className?: string;
}

const SEVERITY_META: Record<Severity, { color: string; bg: string; ring: string; icon: typeof MdWarningAmber; label: string }> = {
  critical: {
    color: 'text-error',
    bg: 'bg-error-container',
    ring: 'ring-error/30',
    icon: MdErrorOutline,
    label: 'Critical',
  },
  moderate: {
    color: 'text-tertiary',
    bg: 'bg-tertiary-container',
    ring: 'ring-tertiary/30',
    icon: MdWarningAmber,
    label: 'Moderate',
  },
  minor: {
    color: 'text-primary',
    bg: 'bg-secondary-container',
    ring: 'ring-secondary/30',
    icon: MdInfoOutline,
    label: 'Minor',
  },
};

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, moderate: 1, minor: 2 };

/**
 * Severity-coded list of refactor items (formerly Strengths/Gaps/Recommendations).
 * Sorted critical → minor regardless of input order.
 */
export function CriticalRefactorList({
  items,
  heading = 'Critical Refactors',
  emptyMessage = 'No critical issues detected. Solid baseline.',
  className,
}: CriticalRefactorListProps) {
  const sorted = [...items].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5',
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-title-md font-semibold text-on-surface">{heading}</h3>
        <span className="text-label-sm text-on-surface-variant">
          {sorted.length > 0 ? `${sorted.length} item${sorted.length === 1 ? '' : 's'}` : ''}
        </span>
      </header>

      {sorted.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((item) => {
            const meta = SEVERITY_META[item.severity];
            const Icon = meta.icon;
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl p-3 ring-1',
                  meta.bg,
                  meta.ring,
                )}
              >
                <Icon className={cn('mt-0.5 shrink-0', meta.color)} size={20} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-label-md font-semibold text-on-surface">{item.title}</p>
                    <span className={cn('text-[10px] font-bold uppercase tracking-widest', meta.color)}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-body-sm text-on-surface-variant leading-relaxed">
                    {item.description}
                  </p>
                  {item.ctaLabel && item.onCta && (
                    <button
                      type="button"
                      onClick={item.onCta}
                      className="mt-2 inline-flex items-center gap-1 text-label-md font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      {item.ctaLabel}
                      <MdArrowForward size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
