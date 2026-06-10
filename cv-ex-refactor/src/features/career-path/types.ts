import type {
  AnalyzeRequestLLM,
  Language,
  RoleFamily,
} from '@/features/analyze/types';
import type { FocusAreaT, HorizonYearsT } from '@/lib/schemas/llm-request';

export type FocusArea = FocusAreaT;
export type HorizonYears = HorizonYearsT;

export const FOCUS_AREA_LABELS: Record<FocusArea, string> = {
  leadership: 'Leadership / management',
  depth: 'Deepen specialty',
  breadth: 'Broaden skill set',
  switch_industry: 'Switch industry',
  switch_function: 'Switch function',
  remote: 'Remote / distributed',
  startup: 'Startup',
  big_tech: 'Big tech',
  entrepreneurship: 'Entrepreneurship',
  consulting: 'Consulting',
};

export type SkillImportance = 'high' | 'medium' | 'low';
export type SkillLevel = 'none' | 'basic' | 'intermediate' | 'advanced' | 'expert';

export interface CurrentSnapshot {
  detectedRole: string;
  yearsExperience?: number;
  coreStrengths: string[];
  signatureProjects: string[];
}

export interface TargetRoleSummary {
  title: string;
  rationale: string;
  fitScore: number;
}

export interface Milestone {
  yearOffset: number;
  title: string;
  role: string;
  responsibilities: string[];
  skillsToBuild: string[];
  evidenceToShow: string[];
  certifications?: string[];
}

export interface SkillGap {
  skill: string;
  importance: SkillImportance;
  currentLevel: SkillLevel;
  targetLevel: SkillLevel;
  howToLearn: string;
}

export interface AlternativePath {
  title: string;
  rationale: string;
  pivotSteps: string[];
}

/**
 * Phase 2 — structured quick-win entry. {action, effortHours, outcome}
 * replaces the freeform string. Legacy string-shape responses normalize
 * into this shape with effortHours=0, outcome=''.
 */
export interface QuickWin {
  action: string;
  effortHours: number;
  outcome: string;
}

export interface QuickWins {
  days30: QuickWin[];
  days60: QuickWin[];
  days90: QuickWin[];
}

/**
 * LLM-judged feasibility of the user's aspiration given the CV.
 * `realistic=false` triggers a soft warning banner — we still render the
 * roadmap (LLM is asked to fall back to a pragmatic version) instead of
 * hard-failing on the user.
 *
 * 2026-06-10 Phase 2 — gentleAdvice softness replaced by structured
 * ambitionGap (1-sentence factual gap) + requiredSteps (2-4 bridging
 * steps). gentleAdvice kept as deprecated legacy passthrough so cached
 * roadmaps still render the banner.
 */
export interface Feasibility {
  realistic: boolean;
  reasons: string[];
  /** @deprecated Phase 2 — use ambitionGap + requiredSteps instead. */
  gentleAdvice: string;
  /** Phase 2 — 1-sentence factual gap when realistic=false. */
  ambitionGap?: string;
  /** Phase 2 — 2-4 concrete steps to bridge the gap. */
  requiredSteps?: string[];
  pragmaticAlternative?: string;
}

export interface CareerPathResult {
  feasibility: Feasibility;
  currentSnapshot: CurrentSnapshot;
  targetRole: TargetRoleSummary;
  milestones: Milestone[];
  skillGaps: SkillGap[];
  alternativePaths: AlternativePath[];
  quickWins: QuickWins;
  caveats?: string;
}

export interface AspirationInputs {
  targetRole: string;
  horizonYears: HorizonYears;
  focusAreas: FocusArea[];
  industryShift?: string;
  constraints?: string;
  notes?: string;
}

export type PathTrajectory = 'specialist' | 'leadership' | 'pivot' | 'breadth';

export const TRAJECTORY_LABELS: Record<PathTrajectory, string> = {
  specialist: 'Deepen specialty',
  leadership: 'Leadership track',
  pivot: 'Adjacent pivot',
  breadth: 'Broaden scope',
};

export interface PathSuggestion {
  title: string;
  rationale: string;
  growthAreas: string[];
  fitScore: number;
  trajectory: PathTrajectory;
}

export interface SuggestPathsRequest {
  llm: AnalyzeRequestLLM;
  inputs: {
    cvText: string;
    analysisSummary?: string;
    currentRole?: string;
    language: Language;
  };
}

export interface CareerPathRequest {
  llm: AnalyzeRequestLLM;
  inputs: {
    cvText: string;
    analysisSummary?: string;
    currentRole?: string;
    aspiration: AspirationInputs;
    language: Language;
  };
}

export type { RoleFamily };
