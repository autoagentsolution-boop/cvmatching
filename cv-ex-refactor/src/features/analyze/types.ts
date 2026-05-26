/**
 * Canonical types for the Analyze feature.
 * Derived from cv_fit_scoring_app.html SCORING_SCHEMA (lines 538-564) and renderAll() calls.
 *
 * HTML deviations documented inline:
 * - HTML uses `decision: { level, label }` — we flatten to `decision: Decision` + `decisionLabel: string`
 * - HTML uses `sub_scores` object — we map to `metrics: AnalysisMetric[]` for consistent rendering
 * - HTML uses `keyword_coverage: { matched, partial, missing }` — we normalize to `coverage: AnalysisCoverage[]`
 * - HTML uses `must_have_requirements` array alongside keyword_coverage — merged into `coverage`
 * - HTML `strengths` has `{ title, evidence, jd_signal }` — we keep all three fields
 * - HTML `gaps` has `gap_type: 'cv_wording_gap' | 'real_experience_gap'` — mapped to our `GapType`
 * - HTML `recommendations` has `{ title, action, priority: 'high'|'medium'|'low' }` — we use `priority: number` for sort order
 * - `suggestedSummaryLine` added from HTML schema field `suggested_summary_line`
 * - `detectedRole` added from HTML schema field `detected_role`
 * - `keywordCoverage` preserves separate matched/partial/missing arrays for badge rendering in Phase 03c-C
 */

export type Provider = 'gemini' | 'openai' | 'custom';

export type RoleFamily =
  | 'auto'
  | 'data_engineer'
  | 'data_platform'
  | 'manager'
  | 'pm_delivery'
  | 'solution'
  | 'software'
  | 'other';

export type Strictness = 'balanced' | 'strict' | 'friendly';
export type Language = 'en' | 'vi' | 'auto';
export type Decision = 'strong' | 'good' | 'stretch' | 'low';
export type Severity = 'critical' | 'moderate' | 'minor';
/** HTML uses 'cv_wording_gap' | 'real_experience_gap'; normalized to short form here */
export type GapType = 'wording' | 'real';
export type CoverageStatus = 'match' | 'partial' | 'missing';
/** HTML recommendation priority is string; we use number for sort (1=high, 2=medium, 3=low) */
export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface AnalysisMetric {
  name: string;
  score: number;
  /** Weight is not in HTML sub_scores — set to 1 for all; reserved for Phase 2 custom weights */
  weight: number;
  reason: string;
}

export interface AnalysisStrength {
  title: string;
  evidence: string;
  /** JD phrase that signals this strength — from HTML `jd_signal` field */
  jdSignal?: string;
}

export interface AnalysisGap {
  title: string;
  severity: Severity;
  type: GapType;
  /** HTML calls this `explanation`; renamed for clarity */
  recommendation: string;
  /** HTML `fix_action` — concrete next step */
  fixAction?: string;
}

export interface AnalysisCoverage {
  requirement: string;
  status: CoverageStatus;
  evidence: string;
}

export interface AnalysisRecommendation {
  title: string;
  action: string;
  priority: RecommendationPriority;
}

/** Separate keyword coverage arrays preserved for Phase 03c-C badge chip rendering */
export interface KeywordCoverage {
  matched: string[];
  partial: string[];
  missing: string[];
}

export interface AnalysisResult {
  overallScore: number; // 0-100
  decision: Decision;
  /** Human-readable verdict label from HTML `decision.label` */
  decisionLabel: string;
  /** HTML `detected_role` */
  detectedRole?: string;
  summary: string;
  cvVisibility: number; // 0-100 — HTML `cv_visibility_score`
  realExperience: number; // 0-100 — HTML `real_experience_score`
  risk: number; // 0-100 — HTML `risk_score` (higher = riskier)
  screeningPass: number; // 0-100 — HTML `recruiter_screening_probability`
  interviewReadiness: number; // 0-100 — HTML `interview_readiness_score`
  atsKeyword: number; // 0-100 — HTML `ats_keyword_coverage_percent`
  /** Mapped from HTML `sub_scores` object */
  metrics: AnalysisMetric[];
  /** HTML uses `{ title, evidence, jd_signal }` */
  strengths: AnalysisStrength[];
  gaps: AnalysisGap[];
  /** HTML `red_flags: [{ flag, concern }]` — flattened to strings for display */
  redFlags: Array<{ flag: string; concern: string }>;
  /** `must_have_requirements` merged with keyword_coverage for unified coverage view */
  coverage: AnalysisCoverage[];
  recommendations: AnalysisRecommendation[];
  /** Separate keyword arrays for chip rendering — from HTML `keyword_coverage` */
  keywordCoverage: KeywordCoverage;
  /** HTML `suggested_summary_line` */
  suggestedSummaryLine?: string;
  /** Carries target role label for display in Refined CV aside */
  targetRoleLabel?: string;
}

/**
 * Nine recruiter-grade weighting dimensions sent to the LLM (0-100 each).
 * Must-have requirements are a separate gating filter — not a weight.
 *
 * Modeled after a recruiter rubric. Each dim is intentionally distinct:
 * - coreSkill vs tool — competency vs concrete instrument
 * - production vs domain — system reality vs industry knowledge
 * - evidence vs impact — presence of proof vs magnitude of outcome
 * - seniority vs scope — level vs the kind of work owned
 */
export interface Weights {
  /** Core competencies the role demands (e.g. distributed-system design, data modeling) */
  coreSkill: number;
  /** Concrete tools, platforms, frameworks, systems (e.g. Spark, Airflow, K8s) */
  tool: number;
  /** Has owned the same kind of scope (single team vs cross-org, IC vs lead, greenfield vs maintenance) */
  scope: number;
  /** Real production environments — live systems, real users, business-critical */
  production: number;
  /** Industry / domain context relevant to the role (fintech, ad-tech, healthcare…) */
  domain: number;
  /** Concrete proof in CV: project, role, dates, ownership — not buzzwords */
  evidence: number;
  /** Level, years, ownership level, decision-making authority */
  seniority: number;
  /** Magnitude of outcomes: metrics, percentage gains, scale, business impact */
  impact: number;
  /** Stakeholder collaboration, team & client communication, business acumen */
  communication: number;
}

export interface AnalyzeRequestInputs {
  jdText: string;
  jdUrl?: string;
  cvText: string;
  profileText?: string;
  targetRole: RoleFamily;
  strictness: Strictness;
  language: Language;
  weights: Weights;
  /** Hard-gate requirements extracted from JD — miss any → decision capped at 'stretch' */
  mustHaves: string[];
}

export interface AnalyzeRequestLLM {
  provider: Provider;
  model: string;
  temperature: number;
  baseUrl?: string;
  /** Present iff BYOK; server enforces shared-key path otherwise (field omitted) */
  apiKey?: string;
}

export interface AnalyzeRequest {
  llm: AnalyzeRequestLLM;
  inputs: AnalyzeRequestInputs;
}

/** Payload for /api/generate-cv — mirrors generateMatchedCV() in HTML (lines 788-872) */
export interface GenerateCvRequest {
  llm: AnalyzeRequestLLM;
  inputs: {
    jdText: string;
    cvText: string;
    profileText?: string;
    language: Language;
    /** HTML cvTone options: concise | impact | recruiter | executive */
    tone: 'concise' | 'impact' | 'recruiter' | 'executive';
    /** HTML cvLength options: short | medium | long */
    length: 'short' | 'medium' | 'long';
    /** HTML cvExtra — free-form extra instructions */
    extraInstructions?: string;
  };
  analysisSummary: string;
}
