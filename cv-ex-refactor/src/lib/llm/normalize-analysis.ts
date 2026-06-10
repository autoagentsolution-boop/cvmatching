import type {
  AnalysisResult,
  AnalysisMetric,
  AnalysisCoverage,
  AnalysisGap,
  AnalysisStrength,
  AnalysisRecommendation,
  Decision,
  Severity,
  GapType,
  RecommendationPriority,
  CoverageStatus,
  KeywordCoverage,
} from '@/features/analyze/types';

type RawAny = Record<string, unknown>;

const METRIC_NAMES = [
  'coreSkill',
  'tool',
  'scope',
  'production',
  'domain',
  'evidence',
  'seniority',
  'impact',
  'communication',
] as const;

const DECISION_VALUES: Decision[] = ['strong', 'good', 'stretch', 'low'];
const SEVERITY_VALUES: Severity[] = ['critical', 'moderate', 'minor'];
const PRIORITY_VALUES: RecommendationPriority[] = ['high', 'medium', 'low'];
const COVERAGE_STATUS_VALUES: CoverageStatus[] = ['match', 'partial', 'missing'];

function clamp0_100(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function pickEnum<T extends string>(values: readonly T[], v: unknown, fallback: T): T {
  return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : fallback;
}

function arr(v: unknown): RawAny[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as RawAny[]) : [];
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim());
}

function normalizeMetrics(rawMetrics: unknown): AnalysisMetric[] {
  const items = arr(rawMetrics);
  const byName = new Map<string, RawAny>();
  for (const m of items) {
    const name = str(m.name);
    if (name) byName.set(name, m);
  }
  return METRIC_NAMES.map((name) => {
    const m = byName.get(name) ?? {};
    return {
      name,
      score: clamp0_100(m.score),
      // Per-dim aggregation is equal-weight client-side. Field kept for type compat.
      weight: 100,
      reason: str(m.reason, ''),
    };
  });
}

function normalizeStrengths(raw: unknown): AnalysisStrength[] {
  return arr(raw)
    .map<AnalysisStrength>((s) => {
      const item: AnalysisStrength = {
        title: str(s.title),
        evidence: str(s.evidence),
      };
      const jdSignal = str(s.jdSignal ?? s.jd_signal);
      if (jdSignal) item.jdSignal = jdSignal;
      return item;
    })
    .filter((s) => s.title || s.evidence);
}

function normalizeGaps(raw: unknown): AnalysisGap[] {
  return arr(raw)
    .map<AnalysisGap>((g) => {
      const rawType = str(g.type ?? g.gap_type);
      const type: GapType = rawType === 'real' || rawType === 'real_experience_gap' ? 'real' : 'wording';
      const item: AnalysisGap = {
        title: str(g.title),
        severity: pickEnum(SEVERITY_VALUES, g.severity, 'moderate'),
        type,
        recommendation: str(g.recommendation ?? g.explanation),
      };
      const fix = str(g.fixAction ?? g.fix_action);
      if (fix) item.fixAction = fix;
      return item;
    })
    .filter((g) => g.title || g.recommendation);
}

function normalizeCoverage(raw: unknown, mustHaveRaw: unknown): AnalysisCoverage[] {
  const fromCoverage = arr(raw).map<AnalysisCoverage>((c) => ({
    requirement: str(c.requirement),
    status: pickEnum(COVERAGE_STATUS_VALUES, c.status, 'partial'),
    evidence: str(c.evidence),
  }));
  const fromMustHaves = arr(mustHaveRaw).map<AnalysisCoverage>((m) => {
    const covered = m.covered === true || m.status === 'match';
    return {
      requirement: str(m.requirement),
      status: covered ? 'match' : str(m.gap_type) ? 'missing' : 'partial',
      evidence: str(m.evidence),
    };
  });
  return [...fromCoverage, ...fromMustHaves].filter((c) => c.requirement.length > 0);
}

function normalizeRecommendations(raw: unknown): AnalysisRecommendation[] {
  return arr(raw)
    .map<AnalysisRecommendation>((r) => ({
      title: str(r.title),
      action: str(r.action),
      priority: pickEnum(PRIORITY_VALUES, r.priority, 'medium'),
    }))
    .filter((r) => r.title || r.action);
}

function normalizeRedFlags(raw: unknown): AnalysisResult['redFlags'] {
  return arr(raw)
    .map((f) => ({ flag: str(f.flag), concern: str(f.concern) }))
    .filter((f) => f.flag || f.concern);
}

function normalizeKeywordCoverage(raw: unknown): KeywordCoverage {
  if (!raw || typeof raw !== 'object') {
    return { matched: [], partial: [], missing: [] };
  }
  const r = raw as RawAny;
  return {
    matched: strArr(r.matched),
    partial: strArr(r.partial),
    missing: strArr(r.missing),
  };
}

function normalizeDecisionLabel(label: unknown, decision: Decision): string {
  const fromInput = str(label).trim();
  if (fromInput) return fromInput;
  const fallback: Record<Decision, string> = {
    strong: 'Strong Match',
    good: 'Good Fit',
    stretch: 'Stretch Candidate',
    low: 'Low Match',
  };
  return fallback[decision];
}

export function normalizeAnalysis(rawInput: unknown): AnalysisResult {
  const raw: RawAny =
    rawInput && typeof rawInput === 'object' ? (rawInput as RawAny) : ({} as RawAny);

  const decisionRaw = raw.decision;
  const decision: Decision =
    typeof decisionRaw === 'string'
      ? pickEnum(DECISION_VALUES, decisionRaw, 'good')
      : pickEnum(
          DECISION_VALUES,
          (decisionRaw as RawAny | undefined)?.level,
          'good',
        );

  const decisionLabel = normalizeDecisionLabel(
    typeof decisionRaw === 'object' && decisionRaw !== null
      ? (decisionRaw as RawAny).label
      : raw.decisionLabel,
    decision,
  );

  const result: AnalysisResult = {
    overallScore: clamp0_100(raw.overallScore ?? raw.overall_score),
    decision,
    decisionLabel,
    summary: str(raw.summary),
    cvVisibility: clamp0_100(raw.cvVisibility ?? raw.cv_visibility_score),
    realExperience: clamp0_100(raw.realExperience ?? raw.real_experience_score),
    risk: clamp0_100(raw.risk ?? raw.risk_score),
    screeningPass: clamp0_100(raw.screeningPass ?? raw.recruiter_screening_probability),
    interviewReadiness: clamp0_100(raw.interviewReadiness ?? raw.interview_readiness_score),
    atsKeyword: clamp0_100(raw.atsKeyword ?? raw.ats_keyword_coverage_percent),
    metrics: normalizeMetrics(raw.metrics ?? raw.sub_scores),
    strengths: normalizeStrengths(raw.strengths),
    gaps: normalizeGaps(raw.gaps),
    redFlags: normalizeRedFlags(raw.redFlags ?? raw.red_flags),
    coverage: normalizeCoverage(raw.coverage, raw.must_have_requirements ?? raw.mustHaveRequirements),
    recommendations: normalizeRecommendations(raw.recommendations),
    keywordCoverage: normalizeKeywordCoverage(raw.keywordCoverage ?? raw.keyword_coverage),
  };

  const detected = str(raw.detectedRole ?? raw.detected_role);
  if (detected) result.detectedRole = detected;
  const summaryLine = str(raw.suggestedSummaryLine ?? raw.suggested_summary_line);
  if (summaryLine) result.suggestedSummaryLine = summaryLine;

  // v2 only — track-mismatch flag. Phase 1b. Passthrough; UI surfacing
  // is a separate task. Tolerates absent/partial shapes from legacy
  // responses (pre-roleAlignment).
  const ra = raw.roleAlignment ?? raw.role_alignment;
  if (ra && typeof ra === 'object') {
    const r = ra as RawAny;
    const aligned = r.aligned === true || r.aligned === 'true';
    const note = str(r.note);
    // Only attach when at least one field carries signal — avoid noisy
    // empty objects from JSON parse defaults.
    if (typeof r.aligned !== 'undefined' || note) {
      result.roleAlignment = { aligned, note };
    }
  }

  return result;
}
