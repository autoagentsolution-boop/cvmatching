'use client';

import { Card } from '@/components/ui';
import type { AlternativePath } from './types';

interface Props {
  paths: AlternativePath[];
}

export function AlternativePathsBlock({ paths }: Props) {
  if (!paths.length) return null;

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <header>
        <span className="text-label-md font-bold uppercase tracking-wide text-primary">
          Alternative directions
        </span>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {paths.map((p) => (
          <li
            key={p.title}
            className="flex flex-col gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4"
          >
            <h4 className="font-display text-title-md text-on-surface">{p.title}</h4>
            {p.rationale && (
              <p className="text-body-sm text-on-surface-variant">{p.rationale}</p>
            )}
            {p.pivotSteps.length > 0 && (
              <ol className="list-decimal pl-5 space-y-1 text-body-md text-on-surface">
                {p.pivotSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
