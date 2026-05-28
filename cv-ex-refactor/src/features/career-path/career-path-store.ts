'use client';

import { create } from 'zustand';
import type { AspirationInputs, CareerPathResult, FocusArea, HorizonYears } from './types';

interface CareerPathState {
  targetRole: string;
  horizonYears: HorizonYears;
  focusAreas: FocusArea[];
  industryShift: string;
  constraints: string;
  notes: string;
  result: CareerPathResult | null;
  isGenerating: boolean;
  error: string | null;
  quotaRemaining: number | null;
  setField: <K extends keyof Omit<CareerPathState, 'setField' | 'reset' | 'toggleFocus' | 'getAspiration'>>(
    k: K,
    v: CareerPathState[K],
  ) => void;
  toggleFocus: (area: FocusArea) => void;
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
  result: null as CareerPathResult | null,
  isGenerating: false,
  error: null as string | null,
  quotaRemaining: null as number | null,
};

export const useCareerPath = create<CareerPathState>((set, get) => ({
  ...initial,
  setField: (k, v) => set({ [k]: v } as Partial<CareerPathState>),
  toggleFocus: (area) => {
    const cur = get().focusAreas;
    set({
      focusAreas: cur.includes(area) ? cur.filter((a) => a !== area) : [...cur, area].slice(0, 6),
    });
  },
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
}));
