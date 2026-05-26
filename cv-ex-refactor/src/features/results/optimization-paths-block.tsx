'use client';

import { Badge, Card } from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import type { AnalysisGap, AnalysisStrength, Severity } from '@/features/analyze/types';

export interface OptimizationPathsBlockProps {
  strengths: AnalysisStrength[];
  gaps: AnalysisGap[];
}

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const severityVariant: Record<Severity, BadgeVariant> = {
  critical: 'error',
  moderate: 'warning',
  minor: 'info',
};

export function OptimizationPathsBlock({ strengths, gaps }: OptimizationPathsBlockProps) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-headline-sm text-on-surface">Optimization Paths</h2>

      {strengths.map((s, i) => (
        <Card key={`strength-${i}`} padding="md">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="success" size="sm">Strengthen</Badge>
              <span className="text-body-md font-semibold text-on-surface">{s.title}</span>
            </div>
            <p className="text-body-md text-on-surface-variant">{s.evidence}</p>
          </div>
        </Card>
      ))}

      {gaps.map((g, i) => (
        <Card key={`gap-${i}`} padding="md">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={severityVariant[g.severity]} size="sm">
                {g.severity === 'critical' ? 'Critical gap' : g.severity === 'moderate' ? 'Gap' : 'Minor gap'}
              </Badge>
              <span className="text-body-md font-semibold text-on-surface">{g.title}</span>
            </div>
            <p className="text-body-md text-on-surface-variant">{g.recommendation}</p>
            {g.fixAction && (
              <p className="text-label-sm text-on-surface-variant italic">{g.fixAction}</p>
            )}
          </div>
        </Card>
      ))}

      {strengths.length === 0 && gaps.length === 0 && (
        <p className="text-body-md text-on-surface-variant">No optimization paths found.</p>
      )}
    </div>
  );
}
