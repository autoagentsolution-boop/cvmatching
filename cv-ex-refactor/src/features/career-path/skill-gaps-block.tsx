'use client';

import { Badge, Card } from '@/components/ui';
import type { SkillGap, SkillImportance, SkillLevel } from './types';

const IMPORTANCE_VARIANT: Record<SkillImportance, 'error' | 'warning' | 'info'> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

const LEVEL_ORDER: Record<SkillLevel, number> = {
  none: 0,
  basic: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const LEVEL_LABEL: Record<SkillLevel, string> = {
  none: 'None',
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

interface Props {
  gaps: SkillGap[];
}

export function SkillGapsBlock({ gaps }: Props) {
  if (!gaps.length) return null;

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <header>
        <span className="text-label-md font-bold uppercase tracking-wide text-primary">
          Skill gaps to close
        </span>
      </header>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {gaps.map((g) => (
          <li
            key={g.skill}
            className="flex flex-col gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-title-sm font-bold text-on-surface">{g.skill}</h4>
              <Badge variant={IMPORTANCE_VARIANT[g.importance]} size="sm">
                {g.importance}
              </Badge>
            </div>
            <LevelMeter current={g.currentLevel} target={g.targetLevel} />
            {g.howToLearn && (
              <p className="text-body-sm text-on-surface-variant">{g.howToLearn}</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LevelMeter({ current, target }: { current: SkillLevel; target: SkillLevel }) {
  const currentIdx = LEVEL_ORDER[current];
  const targetIdx = LEVEL_ORDER[target];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
        <span>{LEVEL_LABEL[current]}</span>
        <span>→ {LEVEL_LABEL[target]}</span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={
              i < currentIdx
                ? 'h-1.5 flex-1 rounded-full bg-secondary'
                : i < targetIdx
                  ? 'h-1.5 flex-1 rounded-full bg-tertiary-fixed'
                  : 'h-1.5 flex-1 rounded-full bg-surface-container-highest'
            }
          />
        ))}
      </div>
    </div>
  );
}
