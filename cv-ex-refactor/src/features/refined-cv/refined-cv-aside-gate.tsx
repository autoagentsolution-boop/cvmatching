'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useResolvedSource } from './use-source-resolver';

export interface RefinedCvAsideGateProps {
  /** RefineToolsBlock — only shown when an analyze result exists. */
  refineTools: ReactNode;
}

/**
 * Client gate for the Refined CV aside.
 *
 * - Result present (current source has analyzeResult / jdMatchResult) →
 *   render the Refine Tools form so the user can choose tone/length/mode
 *   and kick off generation.
 * - No result → render a redirect CTA back to CV Analyze. The user can't
 *   refine what hasn't been scored yet.
 */
export function RefinedCvAsideGate({ refineTools }: RefinedCvAsideGateProps) {
  const source = useResolvedSource();
  const analyzeResult = useAnalysis((s) => s.analyzeResult);
  const jdMatchResult = useAnalysis((s) => s.jdMatchResult);

  // Pick the result that matches the current source. job-fit uses a different
  // bridge (sessionStorage CV) and skips this gate — its asideSlot is unused.
  const hasResult =
    source === 'analyze' ? !!analyzeResult :
    source === 'jd-matching' ? !!jdMatchResult :
    // No explicit source → fall back to "any result available".
    !!(analyzeResult || jdMatchResult);

  if (hasResult) return <>{refineTools}</>;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-5">
      <div>
        <h3 className="font-display text-title-md font-semibold text-on-surface">
          Run CV Analyze first
        </h3>
        <p className="mt-1 text-body-sm text-on-surface-variant leading-relaxed">
          Refining a CV needs the scoring + gap analysis that CV Analyze produces.
          Run that step, then come back here to generate the refined version.
        </p>
      </div>
      <Link
        href="/analyze"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-label-md font-semibold text-on-primary hover:bg-primary/90 transition-colors"
      >
        Go to CV Analyze →
      </Link>
    </section>
  );
}
