'use client';

import { Badge, Card, CircularProgress } from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import type { Decision } from '@/features/analyze/types';

export interface MatchScoreBlockProps {
  score: number;
  decision: Decision;
  decisionLabel: string;
  summary: string;
  compact?: boolean;
}

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const decisionVariant: Record<Decision, BadgeVariant> = {
  strong: 'success',
  good: 'info',
  stretch: 'warning',
  low: 'error',
};

export function MatchScoreBlock({
  score,
  decision,
  decisionLabel,
  summary,
  compact = false,
}: MatchScoreBlockProps) {
  const ringSize = compact ? 96 : 160;

  return (
    <Card padding="md" className="flex flex-col items-center gap-4 text-center">
      <CircularProgress
        value={score}
        size={ringSize}
        strokeWidth={compact ? 6 : 8}
        label={
          <span
            className={
              compact
                ? 'font-display text-headline-md text-on-surface'
                : 'font-display text-display-lg text-on-surface'
            }
          >
            {score}
          </span>
        }
      />
      <div className="flex flex-col items-center gap-2">
        <Badge variant={decisionVariant[decision]}>{decisionLabel}</Badge>
        <p className="text-body-md text-on-surface-variant max-w-xs">{summary}</p>
      </div>
    </Card>
  );
}
