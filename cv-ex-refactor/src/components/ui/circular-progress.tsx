'use client';

import type { ReactNode } from 'react';
import { tokens } from '@/lib/design-tokens';
import { cn } from '@/lib/cn';

export interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: ReactNode;
  trackColor?: string;
  progressColor?: string;
  className?: string;
}

export function CircularProgress({
  value,
  size = 192,
  strokeWidth = 8,
  label,
  trackColor,
  progressColor,
  className,
}: CircularProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedValue / 100);
  const center = size / 2;

  // Inline style is the documented exception for SVG stroke colors where
  // Tailwind currentColor cannot reference token values dynamically at runtime.
  const resolvedTrackColor = trackColor ?? tokens.colors.surfaceContainerLow;
  const resolvedProgressColor = progressColor ?? tokens.colors.secondary;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          style={{ stroke: resolvedTrackColor }}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            stroke: resolvedProgressColor,
            strokeDasharray: circumference,
            strokeDashoffset: dashOffset,
            transition: 'stroke-dashoffset 0.35s ease',
          }}
        />
      </svg>
      {label !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label}
        </div>
      )}
    </div>
  );
}
