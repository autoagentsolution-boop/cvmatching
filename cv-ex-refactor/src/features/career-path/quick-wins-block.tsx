'use client';

import { Card } from '@/components/ui';
import type { QuickWins } from './types';

interface Props {
  quickWins: QuickWins;
}

const COLUMNS: Array<{ key: keyof QuickWins; label: string; tint: string }> = [
  { key: 'days30', label: 'Next 30 days', tint: 'bg-secondary-fixed text-on-secondary-fixed' },
  { key: 'days60', label: '30 → 60 days', tint: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  { key: 'days90', label: '60 → 90 days', tint: 'bg-primary-container text-on-primary-container' },
];

export function QuickWinsBlock({ quickWins }: Props) {
  const total = quickWins.days30.length + quickWins.days60.length + quickWins.days90.length;
  if (total === 0) return null;

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <header>
        <span className="text-label-md font-bold uppercase tracking-wide text-primary">
          Quick wins
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = quickWins[col.key];
          return (
            <div key={col.key} className="flex flex-col gap-3">
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-label-sm font-bold ${col.tint}`}
              >
                {col.label}
              </span>
              {items.length === 0 ? (
                <span className="text-body-sm text-on-surface-variant">No actions suggested.</span>
              ) : (
                <ul className="list-disc pl-5 space-y-2">
                  {items.map((it, idx) => (
                    <li key={`${col.key}-${idx}`} className="text-body-md text-on-surface">
                      <div className="font-medium">{it.action}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label-sm text-on-surface-variant">
                        {it.effortHours > 0 && <span>~{it.effortHours}h</span>}
                        {it.outcome && <span>→ {it.outcome}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
