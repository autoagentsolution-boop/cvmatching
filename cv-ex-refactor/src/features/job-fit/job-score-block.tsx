'use client';

import { CircularProgress, Card, Slider } from '@/components/ui';
import { DIM_LABELS, DIM_ORDER } from './types';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

interface JobScoreBlockProps {
  match: JobMatchOut;
}

/**
 * Displays overall score (circular) + 9-dim read-only sliders.
 * Sliders are DISABLED — scores are AI-generated, user cannot edit here.
 * Tooltip per memory rule: "Điểm do AI đánh giá, không chỉnh sửa được trên trang này"
 */
export function JobScoreBlock({ match }: JobScoreBlockProps) {
  const dims = match.dimensionScores;

  return (
    <Card padding="md" className="flex flex-col gap-6">
      {/* Overall score */}
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-6">
        <CircularProgress
          value={match.overallScore}
          size={120}
          strokeWidth={10}
          label={
            <div className="flex flex-col items-center">
              <span className="font-display text-headline-md font-bold text-on-surface">
                {match.overallScore}
              </span>
              <span className="text-label-sm text-on-surface-variant">/ 100</span>
            </div>
          }
          aria-label={`Điểm phù hợp tổng thể: ${match.overallScore} trên 100`}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-label-md font-bold uppercase tracking-wide text-primary">
            Điểm phù hợp tổng thể
          </span>
          <p className="text-body-sm text-on-surface-variant">
            Điểm do AI đánh giá, không chỉnh sửa được trên trang này.
          </p>
        </div>
      </div>

      {/* 9-dim sliders */}
      <div>
        <span className="mb-3 block text-label-md font-bold uppercase tracking-wide text-primary">
          Chi tiết theo từng tiêu chí
        </span>
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          title="Điểm do AI đánh giá, không chỉnh sửa được trên trang này"
        >
          {DIM_ORDER.map((dim) => {
            const score = Math.round((dims[dim] ?? 0) * 100) / 100;
            return (
              <Slider
                key={dim}
                value={[score]}
                onValueChange={() => {/* read-only */}}
                min={0}
                max={100}
                step={1}
                disabled
                label={DIM_LABELS[dim] ?? dim}
                aria-label={`${DIM_LABELS[dim] ?? dim}: ${score}`}
                aria-readonly="true"
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}
