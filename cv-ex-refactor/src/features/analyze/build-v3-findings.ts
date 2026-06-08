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
  // Server schema caps each entry at 400 chars (AnalyzeFindings in
  // lib/schemas/llm-request.ts). LLM responses regularly produce longer
  // recommendation strings — truncate at the boundary so Regenerate doesn't
  // 422 with 'Too big: expected string to have <=400 characters'.
  const MAX = 400;
  const clip = (s: string): string => (s.length > MAX ? s.slice(0, MAX - 1).trimEnd() + '…' : s);

  const strengths = result.strengths
    .map((s) => clip([s.title, s.evidence].filter(Boolean).join(' — ')))
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const wordingGaps = result.gaps
    .filter((g) => g.type === 'wording')
    .map((g) => clip([g.title, g.recommendation, g.fixAction].filter(Boolean).join(' — ')))
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const recommendations = result.recommendations
    .map((r) => clip([r.title, r.action].filter(Boolean).join(' — ')))
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
