'use client';

import { Badge, Card, CircularProgress } from '@/components/ui';
import type { CurrentSnapshot, TargetRoleSummary } from './types';

interface Props {
  snapshot: CurrentSnapshot;
  target: TargetRoleSummary;
}

export function CurrentSnapshotBlock({ snapshot, target }: Props) {
  return (
    <Card padding="lg" className="flex flex-col gap-6">
      <header>
        <span className="text-label-md font-bold uppercase tracking-wide text-primary">
          Where you are → where you're going
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="flex flex-col gap-3">
          <span className="text-label-sm text-on-surface-variant">Current</span>
          <h3 className="font-display text-headline-sm text-on-surface">
            {snapshot.detectedRole}
          </h3>
          {typeof snapshot.yearsExperience === 'number' && (
            <span className="text-body-sm text-on-surface-variant">
              {snapshot.yearsExperience} year{snapshot.yearsExperience === 1 ? '' : 's'} of experience
            </span>
          )}
          {snapshot.coreStrengths.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {snapshot.coreStrengths.map((s) => (
                <Badge key={s} variant="secondary" size="sm">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:flex flex-col items-center gap-1">
          <span className="material-symbols-outlined text-on-surface-variant text-3xl" aria-hidden="true">
            arrow_forward
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-label-sm text-on-surface-variant">Target</span>
          <h3 className="font-display text-headline-sm text-on-tertiary-container">
            {target.title}
          </h3>
          {target.rationale && (
            <p className="text-body-sm text-on-surface-variant">{target.rationale}</p>
          )}
          <div className="flex items-center gap-3">
            <CircularProgress value={target.fitScore} size={56} />
            <div className="flex flex-col">
              <span className="text-label-sm text-on-surface-variant">Current fit</span>
              <span className="text-title-md font-bold text-on-surface">{target.fitScore}/100</span>
            </div>
          </div>
        </div>
      </div>

      {snapshot.signatureProjects.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-label-sm text-on-surface-variant">Signature work</span>
          <ul className="list-disc pl-5 space-y-1">
            {snapshot.signatureProjects.map((p) => (
              <li key={p} className="text-body-md text-on-surface">{p}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
