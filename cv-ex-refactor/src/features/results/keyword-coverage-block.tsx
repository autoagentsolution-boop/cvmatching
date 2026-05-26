'use client';

import { Badge, Card } from '@/components/ui';
import type { KeywordCoverage } from '@/features/analyze/types';

export interface KeywordCoverageBlockProps {
  keywordCoverage: KeywordCoverage;
}

interface GroupProps {
  label: string;
  keywords: string[];
  variant: 'success' | 'warning' | 'error';
}

function KeywordGroup({ label, keywords, variant }: GroupProps) {
  if (keywords.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wide">
        {label} ({keywords.length})
      </span>
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw) => (
          <Badge key={kw} variant={variant} size="sm">
            {kw}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function KeywordCoverageBlock({ keywordCoverage }: KeywordCoverageBlockProps) {
  const { matched, partial, missing } = keywordCoverage;

  return (
    <Card padding="md" className="flex flex-col gap-5">
      <h2 className="font-display text-headline-sm text-on-surface">Keyword Coverage</h2>
      <KeywordGroup label="Matched" keywords={matched} variant="success" />
      <KeywordGroup label="Partial" keywords={partial} variant="warning" />
      <KeywordGroup label="Missing" keywords={missing} variant="error" />
      {matched.length === 0 && partial.length === 0 && missing.length === 0 && (
        <p className="text-body-md text-on-surface-variant">No keyword data available.</p>
      )}
    </Card>
  );
}
