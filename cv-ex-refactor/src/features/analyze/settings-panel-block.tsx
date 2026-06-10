'use client';

import { useEffect, useState } from 'react';
import { MdLock } from 'react-icons/md';
import { Button, FormField, Input, Select, Slider } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useSettings, DEFAULT_MODELS } from './settings-store';
import { useAnalysis } from './analysis-store';
import type { Language, Provider } from './types';
import { clearByokKey, fetchByokStatus, storeByokKey } from './api-client';

const providerOptions: SelectOption[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

// Phase 6 (pragmatic i18n): output language preference is the only
// user-controllable i18n surface today. Full UI string i18n (button
// labels, headings, error toasts) is deferred — see plans for scope.
const languageOptions: SelectOption[] = [
  { value: 'auto', label: 'Theo CV / JD (Auto)' },
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
];

export interface SettingsPanelBlockProps {
  isAuthed: boolean;
}

/**
 * Drawer body content for LLM settings.
 *
 * Pilot mode:
 *  - Default path: server-managed shared key (no input required).
 *  - Optional BYOK: user pastes their own provider key → saved server-side in
 *    an encrypted vault → an opaque httpOnly cookie token rides along on
 *    subsequent requests. The plaintext key never touches localStorage or
 *    later request payloads.
 */
export function SettingsPanelBlock({ isAuthed }: SettingsPanelBlockProps) {
  const {
    provider,
    model,
    temperature,
    baseUrl,
    apiKey,
    hasRegisteredKey,
    registeredKeyTail,
    setField,
  } = useSettings();

  const [byokOpen, setByokOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await fetchByokStatus();
      if (cancelled) return;
      setField('hasRegisteredKey', status.hasKey);
      setField('registeredKeyTail', status.tail);
    })();
    return () => {
      cancelled = true;
    };
  }, [setField]);

  function handleProviderChange(newProvider: Provider) {
    setField('provider', newProvider);
    setField('model', DEFAULT_MODELS[newProvider]);
  }

  async function handleSaveKey() {
    if (!apiKey.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const { tail } = await storeByokKey(apiKey.trim());
      setField('hasRegisteredKey', true);
      setField('registeredKeyTail', tail);
      // Wipe local input immediately — server now holds the encrypted copy.
      setField('apiKey', '');
      setByokOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lưu key thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClearKey() {
    setBusy(true);
    setError(null);
    try {
      await clearByokKey();
      setField('hasRegisteredKey', false);
      setField('registeredKeyTail', null);
      setField('apiKey', '');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <p className="text-label-md font-bold text-on-surface">
          {hasRegisteredKey
            ? 'Đang dùng key của bạn'
            : isAuthed
              ? 'Đang dùng key chung'
              : 'Chưa cài đặt API Key'}
        </p>
        <p className="text-label-sm text-on-surface-variant">
          {hasRegisteredKey
            ? `Key đuôi …${registeredKeyTail ?? '????'} — không giới hạn quota từ hệ thống (chỉ giới hạn theo quota của key).`
            : isAuthed
              ? 'Quota mỗi ngày: 5 phân tích · 2 viết lại CV · 3 lộ trình nghề nghiệp. Reset 00:00 giờ VN. Muốn không giới hạn, nhập key riêng bên dưới.'
              : 'Hiện chưa cài đặt API Key. Vui lòng thêm key ở bên dưới.'}
        </p>
      </div>

      <LanguagePreferenceRow />

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
          <p className="mt-1 text-label-sm text-on-surface-variant">{temperature.toFixed(2)}</p>
        </FormField>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-label-md font-bold text-on-surface">Key riêng của bạn</p>
            <p className="text-label-sm text-on-surface-variant">
              {hasRegisteredKey
                ? `Key đang hoạt động — tự xóa sau 4 giờ.`
                : 'Tự xóa sau 4 giờ hoặc khi bạn bấm Clear.'}
            </p>
          </div>
          {hasRegisteredKey ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={handleClearKey}>
              Clear
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setByokOpen((v) => !v)}
            >
              {byokOpen ? 'Hủy' : 'Thêm key'}
            </Button>
          )}
        </div>

        {byokOpen && !hasRegisteredKey && (
          <div className="mt-3 flex flex-col gap-2">
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
            </FormField>
            {error && <p className="text-label-sm text-error">{error}</p>}
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !apiKey.trim()}
              onClick={handleSaveKey}
            >
              {busy ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Phase 6 — global LLM output language preference. Lives in the
 * analyze-store so every surface (analyze, jd-match, refined-cv,
 * roadmap, cover-letter, job-fit recommend) reads the same value.
 * Mirrors the inline picker on /analyze for users who never visit
 * the analyze form first.
 */
function LanguagePreferenceRow() {
  const language = useAnalysis((s) => s.language);
  const setField = useAnalysis((s) => s.setField);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3 flex flex-col gap-2">
      <FormField label="LLM output language" htmlFor="settings-language">
        <Select
          id="settings-language"
          options={languageOptions}
          value={language}
          onChange={(e) => setField('language', e.target.value as Language)}
        />
      </FormField>
      <p className="text-label-sm text-on-surface-variant leading-relaxed">
        Áp dụng cho mọi output do AI sinh ra (analyze, refined CV, roadmap,
        cover letter, job fit). UI / nút bấm hiện tại vẫn tiếng Việt — i18n
        cho UI chuỗi đang được lên kế hoạch riêng.
      </p>
    </div>
  );
}
