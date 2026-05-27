'use client';

import { MdLock } from 'react-icons/md';
import { Button, FormField, Input, Select, Slider } from '@/components/ui';
import { Checkbox } from '@/components/ui/checkbox';
import type { SelectOption } from '@/components/ui';
import { useSettings, DEFAULT_MODELS } from './settings-store';
import type { Provider } from './types';

export interface SettingsPanelBlockProps {
  isAuthed: boolean;
}

const providerOptions: SelectOption[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

/**
 * Drawer body content for LLM settings.
 * Rendered inside SettingsDrawerTrigger — not a standalone page block.
 */
export function SettingsPanelBlock({ isAuthed }: SettingsPanelBlockProps) {
  const { useSharedKey, provider, model, temperature, baseUrl, apiKey, setField, clear } =
    useSettings();

  function handleProviderChange(newProvider: Provider) {
    setField('provider', newProvider);
    setField('model', DEFAULT_MODELS[newProvider]);
  }

  const showByok = !useSharedKey || !isAuthed;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <p className="text-label-md font-bold text-on-surface">
          Current mode: {showByok ? 'BYOK (your API key)' : 'Shared key (server-managed)'}
        </p>
        <p className="text-label-sm text-on-surface-variant">
          {showByok
            ? isAuthed
              ? 'Using your own provider key. Toggle off "Use shared key" above to keep using BYOK.'
              : 'Sign in to access the shared-key path (5 analyses + 2 rewrites/day per account).'
            : 'Using the server-managed shared key — counts against your daily quota.'}
        </p>
      </div>

      {isAuthed && (
        <Checkbox
          label="Use shared key (your account quota)"
          checked={useSharedKey}
          onCheckedChange={(v) => setField('useSharedKey', v)}
        />
      )}

      {showByok && (
        <div className="flex flex-col gap-4">
          <FormField label="Provider" htmlFor="llm-provider">
            <Select
              id="llm-provider"
              options={providerOptions}
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
            />
          </FormField>

          <FormField label="Model" htmlFor="llm-model">
            <Input
              id="llm-model"
              placeholder={DEFAULT_MODELS[provider]}
              value={model}
              onChange={(e) => setField('model', e.target.value)}
            />
          </FormField>

          {provider === 'custom' && (
            <FormField label="Base URL" htmlFor="llm-base-url">
              <Input
                id="llm-base-url"
                type="url"
                placeholder="https://your-endpoint.com/v1"
                value={baseUrl}
                onChange={(e) => setField('baseUrl', e.target.value)}
              />
            </FormField>
          )}

          <FormField label="Temperature" htmlFor="llm-temperature">
            <Slider
              value={[Math.round(temperature * 100)]}
              onValueChange={([v]) => v !== undefined && setField('temperature', v / 100)}
              min={0}
              max={100}
              aria-label="LLM temperature"
            />
            <p className="mt-1 text-label-sm text-on-surface-variant">
              {temperature.toFixed(2)}
            </p>
          </FormField>

          <FormField label="API key" htmlFor="llm-api-key">
            <Input
              id="llm-api-key"
              type="password"
              autoComplete="off"
              placeholder="sk-…"
              leadingIcon={<MdLock size={16} aria-hidden="true" />}
              value={apiKey}
              onChange={(e) => setField('apiKey', e.target.value)}
            />
            <p className="mt-1 text-label-sm text-on-surface-variant">
              Held in memory for this session only — never stored on disk or in localStorage.
            </p>
          </FormField>

          {apiKey && (
            <div className="flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear key
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
