'use client';

import { MdCheckCircle } from 'react-icons/md';
import { Card } from '@/components/ui';

interface MatchReasonsBlockProps {
  reasons: string[];
}

/**
 * Full list of match reasons (3-5) for the detail page.
 */
export function MatchReasonsBlock({ reasons }: MatchReasonsBlockProps) {
  if (reasons.length === 0) return null;

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <span className="text-label-md font-bold uppercase tracking-wide text-primary">
        Lý do phù hợp
      </span>
      <ul className="flex flex-col gap-2" aria-label="Lý do phù hợp với job này">
        {reasons.map((reason, i) => (
          <li key={i} className="flex items-start gap-3 text-body-md text-on-surface-variant">
            <MdCheckCircle
              size={18}
              className="mt-0.5 shrink-0 text-secondary"
              aria-hidden="true"
            />
            {reason}
          </li>
        ))}
      </ul>
    </Card>
  );
}
