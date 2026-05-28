'use client';

import { Badge, Card } from '@/components/ui';
import type { Milestone } from './types';

interface Props {
  milestones: Milestone[];
}

function formatYear(offset: number): string {
  if (offset < 1) return `${Math.round(offset * 12)} months`;
  const yrs = Number.isInteger(offset) ? offset : offset.toFixed(1);
  return `Year ${yrs}`;
}

export function RoadmapTimelineBlock({ milestones }: Props) {
  return (
    <Card padding="lg" className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <span className="text-label-md font-bold uppercase tracking-wide text-primary">
          Roadmap
        </span>
        <span className="text-label-sm text-on-surface-variant">
          {milestones.length} milestone{milestones.length === 1 ? '' : 's'}
        </span>
      </header>

      <ol className="relative flex flex-col gap-6">
        <div
          className="absolute left-[15px] top-2 bottom-2 w-px bg-outline-variant"
          aria-hidden="true"
        />
        {milestones.map((m, idx) => (
          <li key={`${m.yearOffset}-${idx}`} className="relative pl-12">
            <span
              className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-label-md font-bold"
              aria-hidden="true"
            >
              {idx + 1}
            </span>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <Badge variant="info" size="sm">{formatYear(m.yearOffset)}</Badge>
                <h4 className="font-display text-title-lg text-on-surface">{m.title}</h4>
              </div>
              {m.role && (
                <p className="text-body-sm text-on-surface-variant">
                  <span className="font-semibold">Role:</span> {m.role}
                </p>
              )}

              <MilestoneList label="Responsibilities" items={m.responsibilities} />
              <MilestoneList label="Skills to build" items={m.skillsToBuild} />
              <MilestoneList label="Evidence to show" items={m.evidenceToShow} />
              {m.certifications && m.certifications.length > 0 && (
                <MilestoneList label="Certifications / courses" items={m.certifications} />
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function MilestoneList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-sm font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </span>
      <ul className="list-disc pl-5 space-y-1">
        {items.map((it) => (
          <li key={it} className="text-body-md text-on-surface">{it}</li>
        ))}
      </ul>
    </div>
  );
}
