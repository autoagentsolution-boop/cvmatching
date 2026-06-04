'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AnalysisResult, Language, RoleFamily, Strictness, Weights } from './types';
import { CURRENT_STORAGE_KEY } from './cache-migration';

/** v0.4 candidate role surfaced via /api/analyze when role-infer confidence is low. */
export interface RoleCandidate {
  canonical: string;
  confidence: number;
}

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
  /** Refine meta (Changes Made + Gaps) — separate from matchedCv so downloads/sends never include it. */
  refineNotes: string | null;
  isAnalyzing: boolean;
  isGeneratingCv: boolean;
  error: string | null;
  // ---- v0.4 CV-solo additions ----
  /** Role the server actually scored against (LLM-inferred or user-confirmed). */
  targetRoleConfirmed: string | null;
  /** Role-infer metadata for the inferred-role banner ({canonical, confidence}). */
  inferredRole: RoleCandidate | null;
  /** Whether the API returned needsRoleConfirm and the modal should open. */
  awaitingRoleConfirm: boolean;
  /** Candidates to render in the role-confirm modal. */
  roleCandidates: RoleCandidate[];
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
  refineNotes: null,
  isAnalyzing: false,
  isGeneratingCv: false,
  error: null,
  targetRoleConfirmed: null,
  inferredRole: null,
  awaitingRoleConfirm: false,
  roleCandidates: [],
};

// Persisted to sessionStorage (not localStorage) on purpose:
// - Survives F5 + cross-tab nav within same tab
// - Clears when the tab closes → CV text does not linger for the next user on
//   a shared device. Matches the project's privacy-first stance.
// Transient flags (isAnalyzing, isGeneratingCv, errors) are excluded — they
// should never be restored across reloads.
export const useAnalysis = create<AnalysisState>()(
  persist(
    (set) => ({
      ...initial,
      setField: (k, v) => set({ [k]: v } as Partial<AnalysisState>),
      reset: () => set(initial),
    }),
    {
      name: CURRENT_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        jdText: s.jdText,
        jdUrl: s.jdUrl,
        cvText: s.cvText,
        profileText: s.profileText,
        targetRole: s.targetRole,
        strictness: s.strictness,
        language: s.language,
        weights: s.weights,
        mustHaves: s.mustHaves,
        result: s.result,
        matchedCv: s.matchedCv,
        refineNotes: s.refineNotes,
        targetRoleConfirmed: s.targetRoleConfirmed,
        inferredRole: s.inferredRole,
        // awaitingRoleConfirm + roleCandidates are transient (modal state) —
        // never restored across reloads to avoid surprising the user with a
        // half-completed modal on F5.
      }),
    },
  ),
);
