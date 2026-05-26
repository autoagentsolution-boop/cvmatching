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
  const { useSharedKey, provider, model, temperature, baseUrl, apiKey, rememberKey, setField, clear } =
    useSettings();

  function handleProviderChange(newProvider: Provider) {
    setField('provider', newProvider);
    setField('model', DEFAULT_MODELS[newProvider]);
  }

  const showByok = !useSharedKey || !isAuthed;

  return (
    <div className="flex flex-col gap-5">
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
              Used only for this session unless you check Remember.
            </p>
          </FormField>

          <div className="flex items-center justify-between gap-4">
            <Checkbox
              label="Remember key"
              checked={rememberKey}
              onCheckedChange={(v) => setField('rememberKey', v)}
            />
            {apiKey && (
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear stored key
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
