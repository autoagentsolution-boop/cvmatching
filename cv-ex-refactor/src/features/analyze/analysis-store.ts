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

const initial: Omit<AnalysisState, 'setField' | 'reset'> = {
  jdText: '',
  jdUrl: '',
  cvText: '',
  profileText: '',
  targetRole: 'auto',
  strictness: 'balanced',
  language: 'auto',
  weights: {
    coreSkill: 50,
    tool: 50,
    scope: 50,
    production: 50,
    domain: 50,
    evidence: 50,
    seniority: 50,
    impact: 50,
    communication: 50,
  },
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
