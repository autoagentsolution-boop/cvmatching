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
                <ul className="list-disc pl-5 space-y-1.5">
                  {items.map((it) => (
                    <li key={it} className="text-body-md text-on-surface">{it}</li>
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
