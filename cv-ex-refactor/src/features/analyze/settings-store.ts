'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Provider } from './types';

interface SettingsState {
  useSharedKey: boolean;
  provider: Provider;
  model: string;
  temperature: number;
  baseUrl: string;
  apiKey: string;
  rememberKey: boolean;
  setField: <K extends keyof Omit<SettingsState, 'setField' | 'clear'>>(
    k: K,
    v: SettingsState[K],
  ) => void;
  clear: () => void;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  custom: 'openai/gpt-4o-mini',
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      useSharedKey: false,
      provider: 'gemini',
      model: DEFAULT_MODELS.gemini,
      temperature: 0.3,
      baseUrl: '',
      apiKey: '',
      rememberKey: false,
      setField: (k, v) => set({ [k]: v } as Partial<SettingsState>),
      clear: () => set({ apiKey: '', rememberKey: false }),
    }),
    {
      name: 'cv-ex-settings-v1',
      partialize: (s) => ({
        useSharedKey: s.useSharedKey,
        provider: s.provider,
        model: s.model,
        temperature: s.temperature,
        baseUrl: s.baseUrl,
        rememberKey: s.rememberKey,
        // Only persist apiKey when user explicitly opts in
        apiKey: s.rememberKey ? s.apiKey : '',
      }),
    },
  ),
);

export { DEFAULT_MODELS };
