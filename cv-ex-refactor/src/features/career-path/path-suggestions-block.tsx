'use client';

import { Badge, Card, LoadingState, ErrorState } from '@/components/ui';
import type { PathSuggestion, PathTrajectory } from './types';
import { TRAJECTORY_LABELS } from './types';

const TRAJECTORY_VARIANT: Record<PathTrajectory, 'info' | 'success' | 'warning' | 'secondary'> = {
  specialist: 'info',
  leadership: 'success',
  pivot: 'warning',
  breadth: 'secondary',
};

interface Props {
  suggestions: PathSuggestion[];
  selected: string | null;
  isLoading: boolean;
  error: string | null;
  onSelect: (title: string) => void;
  onRetry: () => void;
}

export function PathSuggestionsBlock({
  suggestions,
  selected,
  isLoading,
  error,
  onSelect,
  onRetry,
}: Props) {
  if (isLoading) {
    return (
      <Card padding="lg">
        <LoadingState
          variant="spinner"
          size="md"
          message="AI đang đề xuất các hướng phát triển từ CV của bạn..."
        />
      </Card>
    );
  }

  if (error) {
    return <ErrorState title="Không lấy được đề xuất" description={error} retry={onRetry} />;
  }

  if (suggestions.length === 0) return null;

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <span className="text-label-md font-bold uppercase tracking-wide text-primary">
          Các hướng phát triển từ CV
        </span>
        <span className="text-label-sm text-on-surface-variant">
          Chọn một hướng → AI sẽ dựng roadmap chi tiết
        </span>
      </header>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {suggestions.map((s) => {
          const isSelected = selected === s.title;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => onSelect(s.title)}
                aria-pressed={isSelected}
                className={[
                  'flex w-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-soft'
                    : 'border-outline-variant/40 bg-surface-container-lowest hover:border-primary/40 hover:bg-surface-container-low',
                ].join(' ')}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <h4 className="text-title-sm font-bold text-on-surface">{s.title}</h4>
                  <Badge variant={TRAJECTORY_VARIANT[s.trajectory]} size="sm">
                    {TRAJECTORY_LABELS[s.trajectory]}
                  </Badge>
                </div>
                {s.rationale && (
                  <p className="text-body-sm text-on-surface-variant">{s.rationale}</p>
                )}
                {s.growthAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {s.growthAreas.map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 text-label-sm text-on-surface-variant">
                  <span>Hiện tại fit:</span>
                  <span className="font-bold text-on-surface">{s.fitScore}/100</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
