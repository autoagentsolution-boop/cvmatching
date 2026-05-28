'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AspirationInputs,
  CareerPathResult,
  FocusArea,
  HorizonYears,
  PathSuggestion,
} from './types';

interface CareerPathState {
  targetRole: string;
  horizonYears: HorizonYears;
  focusAreas: FocusArea[];
  industryShift: string;
  constraints: string;
  notes: string;
  /** LLM-suggested paths (auto-fetched on page load when CV is present). */
  suggestions: PathSuggestion[];
  /** Which suggestion title the user picked — flows into next roadmap call. */
  selectedSuggestion: string | null;
  /** sessionStorage cache key — first 200 chars of cvText, lets us invalidate
   *  cached suggestions when the CV changes without storing the full text. */
  suggestionsCacheKey: string | null;
  isSuggesting: boolean;
  suggestError: string | null;
  result: CareerPathResult | null;
  isGenerating: boolean;
  error: string | null;
  quotaRemaining: number | null;
  setField: <K extends keyof Omit<
    CareerPathState,
    'setField' | 'reset' | 'toggleFocus' | 'getAspiration' | 'selectSuggestion'
  >>(
    k: K,
    v: CareerPathState[K],
  ) => void;
  toggleFocus: (area: FocusArea) => void;
  selectSuggestion: (title: string) => void;
  getAspiration: () => AspirationInputs;
  reset: () => void;
}

const initial = {
  targetRole: '',
  horizonYears: 3 as HorizonYears,
  focusAreas: [] as FocusArea[],
  industryShift: '',
  constraints: '',
  notes: '',
  suggestions: [] as PathSuggestion[],
  selectedSuggestion: null as string | null,
  suggestionsCacheKey: null as string | null,
  isSuggesting: false,
  suggestError: null as string | null,
  result: null as CareerPathResult | null,
  isGenerating: false,
  error: null as string | null,
  quotaRemaining: null as number | null,
};

export const useCareerPath = create<CareerPathState>()(
  persist(
    (set, get) => ({
      ...initial,
      setField: (k, v) => set({ [k]: v } as Partial<CareerPathState>),
      toggleFocus: (area) => {
        const cur = get().focusAreas;
        set({
          focusAreas: cur.includes(area) ? cur.filter((a) => a !== area) : [...cur, area].slice(0, 6),
        });
      },
      selectSuggestion: (title) => set({ selectedSuggestion: title, targetRole: title }),
      getAspiration: () => {
        const s = get();
        const aspiration: AspirationInputs = {
          targetRole: s.targetRole.trim() || 'auto',
          horizonYears: s.horizonYears,
          focusAreas: s.focusAreas,
        };
        if (s.industryShift.trim()) aspiration.industryShift = s.industryShift.trim();
        if (s.constraints.trim()) aspiration.constraints = s.constraints.trim();
        if (s.notes.trim()) aspiration.notes = s.notes.trim();
        return aspiration;
      },
      reset: () => set(initial),
    }),
    {
      name: 'cv-ex-career-path-v1',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        targetRole: s.targetRole,
        horizonYears: s.horizonYears,
        focusAreas: s.focusAreas,
        industryShift: s.industryShift,
        constraints: s.constraints,
        notes: s.notes,
        suggestions: s.suggestions,
        selectedSuggestion: s.selectedSuggestion,
        suggestionsCacheKey: s.suggestionsCacheKey,
        result: s.result,
      }),
    },
  ),
);

/** Cheap cache key derived from CV text — first 200 chars is enough to detect
 *  when the user analyzed a different CV. Full hash would be safer but
 *  overkill for in-session UX. */
export function cvCacheKey(cvText: string): string {
  return cvText.trim().slice(0, 200);
}
