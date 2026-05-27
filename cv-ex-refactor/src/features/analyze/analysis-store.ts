'use client';

import { create } from 'zustand';
import type { AnalysisResult, Language, RoleFamily, Strictness, Weights } from './types';

interface AnalysisState {
  jdText: string;
  jdUrl: string;
  cvText: string;
  profileText: string;
  targetRole: RoleFamily;
  strictness: Strictness;
  language: Language;
  weights: Weights;
  mustHaves: string[];
  isExtractingMustHaves: boolean;
  mustHavesError: string | null;
  result: AnalysisResult | null;
  matchedCv: string | null;
  isAnalyzing: boolean;
  isGeneratingCv: boolean;
  error: string | null;
  setField: <K extends keyof Omit<AnalysisState, 'setField' | 'reset'>>(
    k: K,
    v: AnalysisState[K],
  ) => void;
  reset: () => void;
}

const ZERO_WEIGHTS = {
  coreSkill: 0,
  tool: 0,
  scope: 0,
  production: 0,
  domain: 0,
  evidence: 0,
  seniority: 0,
  impact: 0,
  communication: 0,
} as const;

const initial: Omit<AnalysisState, 'setField' | 'reset'> = {
  jdText: '',
  jdUrl: '',
  cvText: '',
  profileText: '',
  targetRole: 'auto',
  strictness: 'balanced',
  language: 'auto',
  // Weights are per-dim CV-vs-JD scores produced by the LLM, hydrated after analyze
  // via hydrateWeightsFromResult(). Zero on init means "not analyzed yet" — UI uses
  // result presence (not weights values) to gate the sliders.
  weights: { ...ZERO_WEIGHTS },
  mustHaves: [],
  isExtractingMustHaves: false,
  mustHavesError: null,
  result: null,
  matchedCv: null,
  isAnalyzing: false,
  isGeneratingCv: false,
  error: null,
};

export const useAnalysis = create<AnalysisState>((set) => ({
  ...initial,
  setField: (k, v) => set({ [k]: v } as Partial<AnalysisState>),
  reset: () => set(initial),
}));
