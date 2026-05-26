'use client';

import { Badge, Card } from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import type { RecommendationPriority } from '@/features/analyze/types';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const priorityVariant: Record<RecommendationPriority, BadgeVariant> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

export function KeyEnhancementsBlock() {
  const result = useAnalysis((s) => s.result);

  if (!result) return null;

  const top3 = result.recommendations.slice(0, 3);

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <h2 className="font-display text-headline-sm text-on-surface">Key Enhancements</h2>
      {top3.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No enhancements available.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {top3.map((rec, i) => (
            <li key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant={priorityVariant[rec.priority]} size="sm">
                  {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}
                </Badge>
                <span className="text-body-md font-semibold text-on-surface">{rec.title}</span>
              </div>
              <p className="text-body-md text-on-surface-variant pl-1">{rec.action}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
