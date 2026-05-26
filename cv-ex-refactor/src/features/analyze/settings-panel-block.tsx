'use client';

import { useState } from 'react';
import { MdExpandMore, MdLock, MdSettings } from 'react-icons/md';
import { Button, Card, FormField, Input, Select, Slider } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useSettings, DEFAULT_MODELS } from './settings-store';
import type { Provider } from './types';
import { cn } from '@/lib/cn';

export interface SettingsPanelBlockProps {
  isAuthed: boolean;
  /** When true the BYOK section mounts already expanded (e.g. ?mode=byok) */
  defaultExpanded?: boolean;
}

const providerOptions: SelectOption[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

export function SettingsPanelBlock({ isAuthed, defaultExpanded = false }: SettingsPanelBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const { useSharedKey, provider, model, temperature, baseUrl, apiKey, rememberKey, setField, clear } =
    useSettings();

  function handleProviderChange(newProvider: Provider) {
    setField('provider', newProvider);
    setField('model', DEFAULT_MODELS[newProvider]);
  }

  const showByok = !useSharedKey || !isAuthed;

  return (
    <Card padding="md">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40 rounded-md',
        )}
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 text-label-md font-medium text-on-surface">
          <MdSettings size={16} aria-hidden="true" />
          LLM settings
        </span>
        <MdExpandMore
          size={20}
          aria-hidden="true"
          className={cn(
            'text-on-surface-variant transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div className="mt-5 flex flex-col gap-5">
          {/* Shared key toggle — only shown when user is authenticated */}
          {isAuthed && (
            <label className="flex cursor-pointer items-center gap-2.5 text-label-md text-on-surface-variant">
              <input
                type="checkbox"
                checked={useSharedKey}
                onChange={(e) => setField('useSharedKey', e.target.checked)}
                className="h-4 w-4 rounded border-outline-variant accent-on-tertiary-container"
              />
              Use shared key (your account quota)
            </label>
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
                <label className="flex cursor-pointer items-center gap-2.5 text-label-md text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={rememberKey}
                    onChange={(e) => setField('rememberKey', e.target.checked)}
                    className="h-4 w-4 rounded border-outline-variant accent-on-tertiary-container"
                  />
                  Remember key
                </label>

                {apiKey && (
                  <Button variant="ghost" size="sm" onClick={clear}>
                    Clear stored key
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
