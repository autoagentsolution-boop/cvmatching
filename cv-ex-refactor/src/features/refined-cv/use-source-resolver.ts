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
 *
 * Each field uses a primitive/stable-ref selector so zustand's default
 * Object.is equality holds. A single selector returning `{...}` literal
 * would re-create the object on every store update → infinite re-render.
 */
export function useSourceData(): SourceData {
  const source = useResolvedSource();
  const result = useAnalysis((s) =>
    source === 'analyze' ? s.analyzeResult :
    source === 'jd-matching' ? s.jdMatchResult :
    null,
  );
  const weights = useAnalysis((s) =>
    source === 'analyze' ? s.analyzeWeights :
    source === 'jd-matching' ? s.jdMatchWeights :
    ZERO_WEIGHTS,
  );
  const matchedCv = useAnalysis((s) =>
    source === 'analyze' ? s.analyzeMatchedCv :
    source === 'jd-matching' ? s.jdMatchMatchedCv :
    source === 'job-fit' ? s.jobFitMatchedCv :
    null,
  );
  const refineNotes = useAnalysis((s) =>
    source === 'analyze' ? s.analyzeRefineNotes :
    source === 'jd-matching' ? s.jdMatchRefineNotes :
    source === 'job-fit' ? s.jobFitRefineNotes :
    null,
  );
  return { source, result, weights, matchedCv, refineNotes };
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
