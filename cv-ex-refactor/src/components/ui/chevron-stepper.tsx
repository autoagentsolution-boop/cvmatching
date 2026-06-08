'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ChevronStep {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
}

export interface ChevronStepperProps {
  steps: ChevronStep[];
  currentStepId: string;
  completedStepIds?: string[];
  className?: string;
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M2 6l3 3 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * ChevronStepper — 4-step horizontal workflow nav with chevron arrow pills.
 *
 * Active step: filled primary blue (#3980f4).
 * Completed steps: primary-container bg with check icon.
 * Inactive steps: surface-container-high (grey).
 *
 * Mobile (<640px): collapses to dots strip + current step label below.
 */
export function ChevronStepper({
  steps,
  currentStepId,
  completedStepIds = [],
  className,
}: ChevronStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <nav
      aria-label="Workflow steps"
      className={cn('w-full', className)}
    >
      {/* Desktop: chevron pills row */}
      <ol className="hidden sm:flex items-stretch w-full" role="list">
        {steps.map((step, i) => {
          const isActive = step.id === currentStepId;
          const isCompleted = completedStepIds.includes(step.id);
          const isFirst = i === 0;
          const isLast = i === steps.length - 1;

          return (
            <li key={step.id} className="flex-1 flex items-stretch min-w-0">
              <Link
                href={step.href}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'relative flex flex-1 items-center justify-center gap-1.5',
                  'px-4 py-3 text-label-md font-semibold transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  // Chevron shape via clip-path
                  !isFirst && 'pl-7',
                  !isLast && 'pr-7',
                  isActive && 'bg-primary text-on-primary',
                  isCompleted && !isActive && 'bg-primary-container text-on-primary-container',
                  !isActive && !isCompleted && 'bg-surface-container-high text-on-surface-variant',
                  // Hover for inactive
                  !isActive && 'hover:brightness-95',
                )}
                style={{
                  clipPath: isFirst
                    ? isLast
                      ? undefined
                      : 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)'
                    : isLast
                      ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 16px 50%)'
                      : 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)',
                }}
              >
                {isCompleted && !isActive && <CheckIcon />}
                {step.icon && !isCompleted && (
                  <span className="shrink-0 text-[14px] leading-none" aria-hidden="true">
                    {step.icon}
                  </span>
                )}
                <span className="truncate text-[13px]">{step.label}</span>
              </Link>

              {/* 1px gap between chevrons */}
              {!isLast && <div className="w-px shrink-0 bg-surface" />}
            </li>
          );
        })}
      </ol>

      {/* Mobile: dots + current label */}
      <div className="flex sm:hidden flex-col items-center gap-2 py-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={cn(
                'rounded-full transition-all duration-150',
                step.id === currentStepId
                  ? 'h-2.5 w-6 bg-primary'
                  : completedStepIds.includes(step.id)
                    ? 'h-2 w-2 bg-primary-container'
                    : 'h-2 w-2 bg-surface-container-highest',
              )}
            />
          ))}
        </div>
        <span className="text-label-sm font-semibold text-on-surface">
          Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
        </span>
      </div>
    </nav>
  );
}
