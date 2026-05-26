'use client';

import { create } from 'zustand';
import type { AnalysisResult, Language, RoleFamily, Strictness } from './types';

interface AnalysisState {
  jdText: string;
  jdUrl: string;
  cvText: string;
  profileText: string;
  targetRole: RoleFamily;
  strictness: Strictness;
  language: Language;
  weights: { keywordMatch: number; experienceDepth: number; softSkills: number };
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
  weights: { keywordMatch: 50, experienceDepth: 50, softSkills: 50 },
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
