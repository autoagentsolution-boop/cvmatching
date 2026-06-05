import type { AnalysisResult } from './types';

/**
 * Derive the v3 refine-prompt findings payload from an AnalysisResult.
 * Pure function — no LLM call. Used by Results "Generate refined CV" CTA
 * and by Refined CV's "Regenerate" tool so both stay anchored to the SAME
 * analyze findings the user is looking at (no drift).
 */
export function buildV3Findings(
  result: AnalysisResult,
  role: string,
): {
  role: string;
  strengths: string[];
  wordingGaps: string[];
  recommendations: string[];
  suggestedSummaryLine?: string;
  weakDimensions: string[];
} {
  const strengths = result.strengths
    .map((s) => [s.title, s.evidence].filter(Boolean).join(' — '))
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const wordingGaps = result.gaps
    .filter((g) => g.type === 'wording')
    .map((g) => [g.title, g.recommendation, g.fixAction].filter(Boolean).join(' — '))
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const recommendations = result.recommendations
    .map((r) => [r.title, r.action].filter(Boolean).join(' — '))
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const weakDimensions = result.metrics
    .filter((m) => m.score < 60)
    .map((m) => m.name)
    .slice(0, 9);
  return {
    role: role || result.detectedRole || 'Target role',
    strengths,
    wordingGaps,
    recommendations,
    ...(result.suggestedSummaryLine ? { suggestedSummaryLine: result.suggestedSummaryLine } : {}),
    weakDimensions,
  };
}
