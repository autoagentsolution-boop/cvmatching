import { cn } from '@/lib/cn';
import { semanticForTier, type TierLetter } from '@/lib/jobs/fit-tier';

export interface TierBadgeProps {
  tier: TierLetter;
  /** Override semantic label (defaults to semanticForTier(tier)). */
  semanticLabel?: string | undefined;
  /** Appended to tooltip after semantic label — typically the main matchReason. */
  reason?: string | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

// Direct color utilities; UI-polish plan (260603-1205-ui-polish) will swap to tokens.
// Tier intent: S=gold/elite, A=green/strong, B=blue/solid, C=orange/stretch, D=gray/low, E=red/avoid.
const tierClasses: Record<TierLetter, string> = {
  S: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
  A: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300',
  B: 'bg-sky-100 text-sky-900 ring-1 ring-sky-300',
  C: 'bg-orange-100 text-orange-900 ring-1 ring-orange-300',
  D: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300',
  E: 'bg-rose-100 text-rose-900 ring-1 ring-rose-300',
};

const sizeClasses: Record<NonNullable<TierBadgeProps['size']>, string> = {
  sm: 'h-5 w-5 text-[11px]',
  md: 'h-7 w-7 text-sm',
};

export function TierBadge({
  tier,
  semanticLabel,
  reason,
  size = 'md',
  className,
}: TierBadgeProps) {
  const label = semanticLabel ?? semanticForTier(tier);
  const tooltip = reason ? `${label} — ${reason}` : label;

  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold tabular-nums',
        tierClasses[tier],
        sizeClasses[size],
        className,
      )}
    >
      {tier}
    </span>
  );
}
