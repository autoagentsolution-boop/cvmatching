'use client';

import { CircularProgress } from './circular-progress';
import { tokens } from '@/lib/design-tokens';
import { cn } from '@/lib/cn';
import type { FitTier } from '@/lib/scoring/role-fit-aggregate';

export interface RoleFitGaugeProps {
  score: number;
  tier: FitTier;
  tierLabel: string;
  /** Detected role label, e.g. "Senior Backend Engineer". */
  roleLabel?: string;
  /** Variant — CV Analyze uses primary blue; JD Matching uses tertiary. */
  variant?: 'role-fit' | 'jd-match';
  /** Caption rendered below the score (e.g. coaching line). */
  caption?: string;
  /** Optional CTA button rendered below caption. */
  cta?: React.ReactNode;
  className?: string;
}

const TIER_COLORS: Record<FitTier, string> = {
  strong: tokens.colors.primary,
  partial: tokens.colors.tertiary,
  stretch: tokens.colors.error,
};

/**
 * Role-fit hero gauge — big circular score with tier label, role chip, and caption.
 * Reuses CircularProgress for the SVG arc.
 */
export function RoleFitGauge({
  score,
  tier,
  tierLabel,
  roleLabel,
  variant = 'role-fit',
  caption,
  cta,
  className,
}: RoleFitGaugeProps) {
  const progressColor = variant === 'jd-match' ? tokens.colors.tertiary : TIER_COLORS[tier];

  return (
    <section
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center',
        className,
      )}
      aria-labelledby="role-fit-gauge-heading"
    >
      {roleLabel && (
        <div className="flex items-center gap-2 text-label-md text-on-surface-variant">
          <span className="text-[10px] font-bold uppercase tracking-widest">Detected Role</span>
          <span className="rounded-full bg-surface-container-low px-2.5 py-0.5 text-body-sm font-medium text-on-surface">
            {roleLabel}
          </span>
        </div>
      )}

      <CircularProgress
        value={Number.isFinite(score) ? score : 0}
        size={176}
        strokeWidth={10}
        progressColor={progressColor}
        label={
          <div className="flex flex-col items-center">
            <span className="font-display text-display-sm font-bold tabular-nums leading-none text-on-surface">
              {Number.isFinite(score) ? Math.round(score) : 0}
            </span>
            <span className="mt-1 text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
              {tierLabel}
            </span>
          </div>
        }
      />

      <h2
        id="role-fit-gauge-heading"
        className="sr-only"
      >
        Overall Role Fit Score
      </h2>

      {caption && (
        <p className="max-w-md text-body-sm text-on-surface-variant leading-relaxed">
          {caption}
        </p>
      )}

      {cta}
    </section>
  );
}
