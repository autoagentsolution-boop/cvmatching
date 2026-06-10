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

/**
 * Result source — one of three Refined-CV entry points. Used to namespace
 * `result/weights/matchedCv/refineNotes` so the three flows never overwrite
 * each other (was a real bug pre-2026-06-05 split).
 */
export type ResultSource = 'analyze' | 'jd-matching' | 'job-fit';

interface AnalysisState {
  // ── shared inputs / settings (same across all sources) ─────────────────
  jdText: string;
  jdUrl: string;
  /** MIME of the most recently imported JD (e.g. 'application/pdf'). null
   *  for paste-only or URL-scrape (no original file). Persisted so the
   *  Source JD viewer can re-render the correct mode after a tab reload. */
  jdMime: string | null;
  /** Object URL of the most recently uploaded JD file. Non-persisted —
   *  blob URLs can't survive a reload. When null after reload, the viewer
   *  falls back to the styled text render of jdText. */
  jdOriginalBlobUrl: string | null;
  /** Cleaned HTML body from URL scrape (Readability / JSON-LD). Used by
   *  JdSourceCard to render a reader-view with original headings/lists.
   *  Empty for paste or file-upload modes. */
  jdSourceHtml: string;
  /** Title from URL scrape (e.g. "Senior Data Engineer — Tiki"). */
  jdSourceTitle: string;
  profileText: string;

  // ── per-source CV inputs ───────────────────────────────────────────────
  // Users can keep different CVs for Analyze (general role) vs JD Matching
  // (tailored to a specific JD). Job Fit context CV bridges via
  // sessionStorage['refined-cv-text:v1'] — written by Analyze/JD-Match on
  // run success; Job Fit list + Refined CV (jobId path) + CoverLetterBlock
  // all read that key.
  analyzeCvText: string;
  jdMatchCvText: string;

  targetRole: RoleFamily;
  strictness: Strictness;
  language: Language;
  mustHaves: string[];
  isExtractingMustHaves: boolean;
  mustHavesError: string | null;

  // ── per-source slots ───────────────────────────────────────────────────
  // Analyze (v0.4 CV-solo) — written by AnalyzeActions + results re-analyze.
  analyzeResult: AnalysisResult | null;
  analyzeWeights: Weights;
  analyzeMatchedCv: string | null;
  analyzeRefineNotes: string | null;

  // JD Matching (v2 CV-vs-JD) — written by JdMatchingActions + results regen.
  jdMatchResult: AnalysisResult | null;
  jdMatchWeights: Weights;
  jdMatchMatchedCv: string | null;
  jdMatchRefineNotes: string | null;

  // Job Fit — only generates a refined CV (no result/weights; useJobFit owns
  // the source data). Written by RefinedCvModeBanner when ?jobId&mode present.
  jobFitMatchedCv: string | null;
  jobFitRefineNotes: string | null;

  /** Pointer to the source the user most recently worked with. Refined CV
   *  falls back to this when no `?from=` / `?jobId` URL param is present. */
  activeResultSource: ResultSource | null;

  // ── transient UI state (excluded from persistence) ─────────────────────
  isAnalyzing: boolean;
  isGeneratingCv: boolean;
  error: string | null;
  // v0.4 CV-solo role-infer flow — only used by Analyze (v3) path.
  targetRoleConfirmed: string | null;
  inferredRole: RoleCandidate | null;
  awaitingRoleConfirm: boolean;
  roleCandidates: RoleCandidate[];

  setField: <K extends keyof Omit<AnalysisState, 'setField' | 'reset'>>(
    k: K,
    v: AnalysisState[K],
  ) => void;
  reset: () => void;
}

const ZERO_WEIGHTS: Weights = {
  coreSkill: 0,
  tool: 0,
  scope: 0,
  production: 0,
  domain: 0,
  evidence: 0,
  seniority: 0,
  impact: 0,
  communication: 0,
};

const initial: Omit<AnalysisState, 'setField' | 'reset'> = {
  jdText: '',
  jdUrl: '',
  jdMime: null,
  jdOriginalBlobUrl: null,
  jdSourceHtml: '',
  jdSourceTitle: '',
  profileText: '',
  analyzeCvText: '',
  jdMatchCvText: '',
  targetRole: 'auto',
  strictness: 'balanced',
  language: 'auto',
  mustHaves: [],
  isExtractingMustHaves: false,
  mustHavesError: null,

  analyzeResult: null,
  analyzeWeights: { ...ZERO_WEIGHTS },
  analyzeMatchedCv: null,
  analyzeRefineNotes: null,

  jdMatchResult: null,
  jdMatchWeights: { ...ZERO_WEIGHTS },
  jdMatchMatchedCv: null,
  jdMatchRefineNotes: null,

  jobFitMatchedCv: null,
  jobFitRefineNotes: null,

  activeResultSource: null,

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
        jdMime: s.jdMime,
        // jdOriginalBlobUrl deliberately excluded — blob URLs are tab-scoped
        // and don't survive reload. Viewer falls back to styled text.
        jdSourceHtml: s.jdSourceHtml,
        jdSourceTitle: s.jdSourceTitle,
        profileText: s.profileText,
        analyzeCvText: s.analyzeCvText,
        jdMatchCvText: s.jdMatchCvText,
        targetRole: s.targetRole,
        strictness: s.strictness,
        language: s.language,
        mustHaves: s.mustHaves,

        analyzeResult: s.analyzeResult,
        analyzeWeights: s.analyzeWeights,
        analyzeMatchedCv: s.analyzeMatchedCv,
        analyzeRefineNotes: s.analyzeRefineNotes,

        jdMatchResult: s.jdMatchResult,
        jdMatchWeights: s.jdMatchWeights,
        jdMatchMatchedCv: s.jdMatchMatchedCv,
        jdMatchRefineNotes: s.jdMatchRefineNotes,

        jobFitMatchedCv: s.jobFitMatchedCv,
        jobFitRefineNotes: s.jobFitRefineNotes,

        activeResultSource: s.activeResultSource,
        targetRoleConfirmed: s.targetRoleConfirmed,
        inferredRole: s.inferredRole,
        // awaitingRoleConfirm + roleCandidates are transient (modal state) —
        // never restored across reloads.
      }),
      // 2026-06-10 Phase 1b: legacy persisted state may carry
      // `strictness: 'friendly'` (dropped enum value). Coerce to 'balanced'
      // before any consumer reads it — otherwise the first /api/analyze
      // call zod-parse 400s on the body.
      onRehydrateStorage: () => (state) => {
        if (state && (state.strictness as string) === 'friendly') {
          state.strictness = 'balanced';
        }
      },
    },
  ),
);
