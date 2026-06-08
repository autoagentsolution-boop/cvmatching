/**
 * Client-side aggregation of analyze-v3 9-dim metrics into 3 role-fit headline scores.
 *
 * Per design-intent.md decision #8: ZERO LLM cost — pure math derived from existing
 * `AnalysisResult.metrics[]` (LLM-scored 0-100 per dim) + `atsKeyword` + `keywordCoverage`.
 *
 *   Role           = avg(coreSkill, scope, domain)
 *   Experience     = avg(seniority, production, impact)
 *   Keyword Match  = atsKeyword (preferred) OR matched / (matched + partial + missing)
 *
 * Both inputs and outputs clamped to 0-100 integers. Missing/unknown dims contribute 0.
 */

import type { AnalysisMetric, KeywordCoverage } from '@/features/analyze/types';

export interface RoleFitScores {
  /** Aggregate of coreSkill + scope + domain (role-aligned competency). */
  role: number;
  /** Aggregate of seniority + production + impact (experience depth). */
  experience: number;
  /** ATS-style keyword match — direct from atsKeyword or coverage ratio. */
  keywordMatch: number;
}

export interface RoleFitInputs {
  metrics: AnalysisMetric[];
  /** Optional — preferred direct measure from analyze-v3. */
  atsKeyword?: number;
  /** Optional fallback when atsKeyword absent or zero. */
  keywordCoverage?: KeywordCoverage;
}

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function avgMetrics(metrics: AnalysisMetric[], names: readonly string[]): number {
  const byName = new Map(metrics.map((m) => [m.name, m]));
  let sum = 0;
  let count = 0;
  for (const n of names) {
    const m = byName.get(n);
    if (m && Number.isFinite(m.score)) {
      sum += m.score;
      count += 1;
    }
  }
  return count > 0 ? clamp(sum / count) : 0;
}

function coverageRatio(c: KeywordCoverage): number {
  const total = c.matched.length + c.partial.length + c.missing.length;
  if (total === 0) return 0;
  // Partial counted at half-weight to match analyze-v3 atsKeyword scoring intent.
  const score = (c.matched.length + c.partial.length * 0.5) / total;
  return clamp(score * 100);
}

export function aggregateRoleFit(inputs: RoleFitInputs): RoleFitScores {
  const role = avgMetrics(inputs.metrics, ['coreSkill', 'scope', 'domain']);
  const experience = avgMetrics(inputs.metrics, ['seniority', 'production', 'impact']);

  let keywordMatch = 0;
  if (typeof inputs.atsKeyword === 'number' && inputs.atsKeyword > 0) {
    keywordMatch = clamp(inputs.atsKeyword);
  } else if (inputs.keywordCoverage) {
    keywordMatch = coverageRatio(inputs.keywordCoverage);
  }

  return { role, experience, keywordMatch };
}

export type FitTier = 'strong' | 'partial' | 'stretch';

export function classifyFit(score: number): { tier: FitTier; label: string } {
  if (score >= 75) return { tier: 'strong', label: 'STRONG FIT' };
  if (score >= 55) return { tier: 'partial', label: 'PARTIAL FIT' };
  return { tier: 'stretch', label: 'STRETCH' };
}
