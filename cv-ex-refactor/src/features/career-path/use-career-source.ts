'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAnalysis, type ResultSource } from '@/features/analyze/analysis-store';
import { JOB_FIT_CV_SESSION_KEY } from '@/features/refined-cv/use-source-resolver';
import type { AnalysisResult } from '@/features/analyze/types';

export interface CareerSourceCtx {
  source: ResultSource | null;
  cvText: string;
  /** Analyze result for summary/detectedRole hinting. Null for source='job-fit'
   *  (Job Fit didn't run analyze — career-path uses target+skillGaps from URL). */
  analysisResult: AnalysisResult | null;
}

/**
 * Resolve which source seeded the Career Path call. URL `?from=` is the
 * explicit hand-off from Analyze / JD Matching results, or from Job Fit
 * "Xem Roadmap" CTA. Fallback chain: analyze CV → jd-match CV → job-fit
 * sessionStorage CV. analysisResult is null for job-fit since the matched
 * job context comes via URL params, not from an AnalysisResult.
 */
export function useCareerSource(): CareerSourceCtx {
  const params = useSearchParams();
  const from = params.get('from');
  const fromParam: ResultSource | null =
    from === 'analyze' || from === 'jd-matching' || from === 'job-fit' ? from : null;

  const analyzeCvText = useAnalysis((s) => s.analyzeCvText);
  const jdMatchCvText = useAnalysis((s) => s.jdMatchCvText);
  const analyzeResult = useAnalysis((s) => s.analyzeResult);
  const jdMatchResult = useAnalysis((s) => s.jdMatchResult);

  const [sessionCv, setSessionCv] = useState('');
  const needsSessionCv = fromParam === 'job-fit' || (fromParam == null && !analyzeCvText && !jdMatchCvText);
  useEffect(() => {
    if (!needsSessionCv) return;
    try {
      setSessionCv(window.sessionStorage.getItem(JOB_FIT_CV_SESSION_KEY) ?? '');
    } catch {
      setSessionCv('');
    }
  }, [needsSessionCv]);

  if (fromParam === 'analyze') {
    return { source: 'analyze', cvText: analyzeCvText, analysisResult: analyzeResult };
  }
  if (fromParam === 'jd-matching') {
    return { source: 'jd-matching', cvText: jdMatchCvText, analysisResult: jdMatchResult };
  }
  if (fromParam === 'job-fit') {
    return { source: 'job-fit', cvText: sessionCv, analysisResult: null };
  }
  // No `?from`: prefer analyze, then jd-match, then session bridge.
  if (analyzeCvText) return { source: 'analyze', cvText: analyzeCvText, analysisResult: analyzeResult };
  if (jdMatchCvText) return { source: 'jd-matching', cvText: jdMatchCvText, analysisResult: jdMatchResult };
  return { source: null, cvText: sessionCv, analysisResult: null };
}
