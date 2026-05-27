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
      setField: (k, v) => set({ [k]: v } as Partial<SettingsState>),
      clear: () => set({ apiKey: '' }),
    }),
    {
      name: 'cv-ex-settings-v1',
      version: 2,
      // v1 → v2: strip apiKey and rememberKey from any existing persisted blob.
      // apiKey is intentionally never persisted — held in memory for the
      // session only. Avoids at-rest exposure in localStorage (XSS surface).
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        const { apiKey: _apiKey, rememberKey: _rememberKey, ...rest } =
          persisted as Record<string, unknown>;
        return rest;
      },
      partialize: (s) => ({
        useSharedKey: s.useSharedKey,
        provider: s.provider,
        model: s.model,
        temperature: s.temperature,
        baseUrl: s.baseUrl,
      }),
    },
  ),
);

export { DEFAULT_MODELS };
