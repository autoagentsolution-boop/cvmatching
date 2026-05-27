'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Provider } from './types';

interface SettingsState {
  provider: Provider;
  model: string;
  temperature: number;
  baseUrl: string;
  // Raw input field for the BYOK key. Cleared as soon as it is sent to
  // /api/keys/store (the server vault). Never persisted to localStorage.
  apiKey: string;
  // Mirrored from /api/keys/status — true when an encrypted key is currently
  // held in the server vault for this browser. UI uses this, not `apiKey`,
  // to decide whether to show "key registered".
  hasRegisteredKey: boolean;
  registeredKeyTail: string | null;
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
      provider: 'gemini',
      model: DEFAULT_MODELS.gemini,
      temperature: 0.3,
      baseUrl: '',
      apiKey: '',
      hasRegisteredKey: false,
      registeredKeyTail: null,
      setField: (k, v) => set({ [k]: v } as Partial<SettingsState>),
      clear: () => set({ apiKey: '', hasRegisteredKey: false, registeredKeyTail: null }),
    }),
    {
      name: 'cv-ex-settings-v1',
      version: 3,
      // v1/v2 → v3: strip apiKey, rememberKey, useSharedKey from any older
      // persisted blob. apiKey lives in memory only (never persisted); shared
      // vs BYOK is now decided by whether the server vault has a token.
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        const {
          apiKey: _apiKey,
          rememberKey: _rememberKey,
          useSharedKey: _useSharedKey,
          hasRegisteredKey: _hasRegisteredKey,
          registeredKeyTail: _registeredKeyTail,
          ...rest
        } = persisted as Record<string, unknown>;
        return rest;
      },
      partialize: (s) => ({
        provider: s.provider,
        model: s.model,
        temperature: s.temperature,
        baseUrl: s.baseUrl,
      }),
    },
  ),
);

export { DEFAULT_MODELS };
