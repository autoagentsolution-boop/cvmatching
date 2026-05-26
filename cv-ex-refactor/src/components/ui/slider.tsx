'use client';

import * as RadixSlider from '@radix-ui/react-slider';
import { cn } from '@/lib/cn';

export interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  'aria-label'?: string;
  className?: string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label,
  'aria-label': ariaLabel,
  className,
}: SliderProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-label-md text-on-surface-variant">{label}</span>
          <span className="text-label-md font-medium text-on-surface">{value[0]}</span>
        </div>
      )}
      <RadixSlider.Root
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          'relative flex h-5 w-full touch-none select-none items-center',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <RadixSlider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-surface-container-highest">
          <RadixSlider.Range className="absolute h-full bg-gradient-to-r from-secondary to-tertiary" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          className={cn(
            'block h-5 w-5 rounded-full bg-surface-container-lowest shadow-soft',
            'border-2 border-outline-variant',
            'transition-transform duration-150 hover:scale-110',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/20',
          )}
        />
      </RadixSlider.Root>
    </div>
  );
}
