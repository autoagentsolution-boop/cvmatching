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

export interface QuickWins {
  days30: string[];
  days60: string[];
  days90: string[];
}

/**
 * LLM-judged feasibility of the user's aspiration given the CV.
 * `realistic=false` triggers a soft warning banner — we still render the
 * roadmap (LLM is asked to fall back to a pragmatic version) instead of
 * hard-failing on the user.
 */
export interface Feasibility {
  realistic: boolean;
  reasons: string[];
  gentleAdvice: string;
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
