'use client';

import { useSearchParams } from 'next/navigation';
import { useAnalysis, type ResultSource } from '@/features/analyze/analysis-store';
import type { AnalysisResult, Weights } from '@/features/analyze/types';

const ZERO_WEIGHTS: Weights = {
  coreSkill: 0,
  tool: 0,
  scope: 0,
  production: 0,
  domain: 0,
  evidence: 0,
  seniority: 0,
  impact: 0,
  communication: 0,
};

/**
 * Resolve which Result source the current /refined-cv view should render:
 *   1. `?jobId=&mode=`        → 'job-fit' (Job Fit detail's Apply CTA)
 *   2. `?from=analyze`        → 'analyze'
 *   3. `?from=jd-matching`    → 'jd-matching'
 *   4. else fall back to store's last-active source pointer
 *   5. else null (Refined CV empty state)
 *
 * Reading from URL keeps deep-link semantics: each entry point owns its slot,
 * back/forward nav never drags state across sources.
 */
export function useResolvedSource(): ResultSource | null {
  const params = useSearchParams();
  const fallback = useAnalysis((s) => s.activeResultSource);

  if (params.get('jobId')) return 'job-fit';
  const from = params.get('from');
  if (from === 'analyze' || from === 'jd-matching') return from;
  return fallback;
}

export interface SourceData {
  source: ResultSource | null;
  result: AnalysisResult | null;
  weights: Weights;
  matchedCv: string | null;
  refineNotes: string | null;
}

/**
 * Read-only snapshot of the active source's result/weights/matchedCv. Job
 * Fit source has no result/weights — UI blocks that depend on them should
 * branch on `source === 'job-fit'` and render from useJobFit() instead.
 */
export function useSourceData(): SourceData {
  const source = useResolvedSource();
  return useAnalysis((s) => {
    if (source === 'analyze') {
      return {
        source,
        result: s.analyzeResult,
        weights: s.analyzeWeights,
        matchedCv: s.analyzeMatchedCv,
        refineNotes: s.analyzeRefineNotes,
      };
    }
    if (source === 'jd-matching') {
      return {
        source,
        result: s.jdMatchResult,
        weights: s.jdMatchWeights,
        matchedCv: s.jdMatchMatchedCv,
        refineNotes: s.jdMatchRefineNotes,
      };
    }
    if (source === 'job-fit') {
      return {
        source,
        result: null,
        weights: ZERO_WEIGHTS,
        matchedCv: s.jobFitMatchedCv,
        refineNotes: s.jobFitRefineNotes,
      };
    }
    return { source: null, result: null, weights: ZERO_WEIGHTS, matchedCv: null, refineNotes: null };
  });
}

export interface SourceSetters {
  setResult: (v: AnalysisResult | null) => void;
  setWeights: (v: Weights) => void;
  setMatchedCv: (v: string | null) => void;
  setRefineNotes: (v: string | null) => void;
}

/**
 * Setters for the active source's slots. Job Fit source returns no-op
 * setResult/setWeights (Job Fit doesn't own those fields).
 */
export function useSourceSetters(source: ResultSource | null): SourceSetters {
  const setField = useAnalysis((s) => s.setField);
  const noop = (): void => {};

  if (source === 'analyze') {
    return {
      setResult: (v) => setField('analyzeResult', v),
      setWeights: (v) => setField('analyzeWeights', v),
      setMatchedCv: (v) => setField('analyzeMatchedCv', v),
      setRefineNotes: (v) => setField('analyzeRefineNotes', v),
    };
  }
  if (source === 'jd-matching') {
    return {
      setResult: (v) => setField('jdMatchResult', v),
      setWeights: (v) => setField('jdMatchWeights', v),
      setMatchedCv: (v) => setField('jdMatchMatchedCv', v),
      setRefineNotes: (v) => setField('jdMatchRefineNotes', v),
    };
  }
  if (source === 'job-fit') {
    return {
      setResult: noop,
      setWeights: noop,
      setMatchedCv: (v) => setField('jobFitMatchedCv', v),
      setRefineNotes: (v) => setField('jobFitRefineNotes', v),
    };
  }
  return { setResult: noop, setWeights: noop, setMatchedCv: noop, setRefineNotes: noop };
}
