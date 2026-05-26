'use client';

import { Badge, Card } from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import type { AnalysisRecommendation, RecommendationPriority } from '@/features/analyze/types';

export interface RecommendationsBlockProps {
  recommendations: AnalysisRecommendation[];
}

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const priorityVariant: Record<RecommendationPriority, BadgeVariant> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

const priorityOrder: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function RecommendationsBlock({ recommendations }: RecommendationsBlockProps) {
  const sorted = [...recommendations].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-headline-sm text-on-surface">Recommendations</h2>
      {sorted.map((rec, i) => (
        <Card key={i} padding="md">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={priorityVariant[rec.priority]} size="sm">
                {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} priority
              </Badge>
              <span className="text-body-md font-semibold text-on-surface">{rec.title}</span>
            </div>
            <p className="text-body-md text-on-surface-variant">{rec.action}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
