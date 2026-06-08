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

// Severity is surfaced via a small icon + accent ring on the LEFT edge —
// not by saturating the whole card background. Heavy backgrounds dominate
// the page visually and crush text contrast; keep cards on neutral surface.
const SEVERITY_META: Record<Severity, { color: string; iconBg: string; icon: typeof MdWarningAmber; label: string }> = {
  critical: {
    color: 'text-error',
    iconBg: 'bg-error/10',
    icon: MdErrorOutline,
    label: 'Critical',
  },
  moderate: {
    color: 'text-tertiary',
    iconBg: 'bg-tertiary/10',
    icon: MdWarningAmber,
    label: 'Moderate',
  },
  minor: {
    color: 'text-primary',
    iconBg: 'bg-primary/10',
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
                className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3"
              >
                <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.iconBg)}>
                  <Icon className={meta.color} size={18} aria-hidden="true" />
                </span>
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
