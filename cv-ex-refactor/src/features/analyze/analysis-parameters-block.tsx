'use client';

import { useState } from 'react';
import { Card, FormField, Select, Slider } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { hydrateWeightsFromResult } from '@/lib/scoring/recompute-overall';
import type { Language, Weights } from './types';

// v0.4: targetRole + strictness + must-haves removed — no JD to anchor them
// against. Language is the only remaining LLM control surface on this page.
const languageOptions: SelectOption[] = [
  { value: 'auto', label: 'Theo CV' },
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
];

interface SliderSpec {
  key: keyof Weights;
  label: string;
  description: string;
}

const SLIDERS: SliderSpec[] = [
  {
    key: 'coreSkill',
    label: 'Core Skill',
    description: 'Năng lực lõi cần cho vai trò (system design, data modeling…).',
  },
  {
    key: 'tool',
    label: 'Tool / Platform',
    description: 'Công cụ, framework, nền tảng quen thuộc cho vai trò.',
  },
  {
    key: 'scope',
    label: 'Scope',
    description: 'Quy mô công việc đã sở hữu — team, IC/lead, greenfield/maintenance.',
  },
  {
    key: 'production',
    label: 'Production',
    description: 'Kinh nghiệm hệ thống thật, người dùng thật, môi trường business-critical.',
  },
  {
    key: 'domain',
    label: 'Domain',
    description: 'Ngữ cảnh ngành cho vai trò — fintech, ad-tech, healthcare…',
  },
  {
    key: 'evidence',
    label: 'Evidence',
    description: 'Bằng chứng cụ thể: project, role, ngày, ownership — không buzzword.',
  },
  {
    key: 'seniority',
    label: 'Seniority',
    description: 'Level, năm kinh nghiệm, quyền ra quyết định, độ sâu sở hữu.',
  },
  {
    key: 'impact',
    label: 'Impact',
    description: 'Độ lớn kết quả — metric, quy mô, business outcome.',
  },
  {
    key: 'communication',
    label: 'Communication',
    description: 'Hợp tác stakeholder, business acumen, soft skills.',
  },
];

interface SliderCellProps {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  description: string;
  disabled?: boolean;
}

function SliderCell({ label, value, onValueChange, description, disabled = false }: SliderCellProps) {
  return (
    <div className={`space-y-3 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-label-md font-bold text-primary">{label}</span>
        <span className="text-label-sm font-bold text-on-tertiary-container">
          {disabled ? '—' : `${value}%`}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => v !== undefined && onValueChange(v)}
        min={0}
        max={100}
        aria-label={label}
        disabled={disabled}
      />
      <p className="text-label-sm text-on-surface-variant">{description}</p>
    </div>
  );
}

export function AnalysisParametersBlock() {
  const { weights, language, result, setField } = useAnalysis();
  const [resetFlash, setResetFlash] = useState(false);

  const hasAnalyzed = result !== null;

  function setWeight(key: keyof Weights, val: number) {
    setField('weights', { ...weights, [key]: val });
  }

  function resetToAiScores() {
    if (!result) return;
    setField('weights', hydrateWeightsFromResult(result));
    setResetFlash(true);
    setTimeout(() => setResetFlash(false), 1500);
  }

  return (
    <Card padding="lg" className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-headline-md font-bold text-primary">Điểm 9 chiều</h3>
          <p className="text-body-md text-on-surface-variant">
            {hasAnalyzed
              ? 'AI đã chấm CV theo 9 chiều cho vai trò mục tiêu. Chỉnh slider nếu bạn không đồng ý — điểm tổng tính lại tức thì.'
              : 'AI sẽ chấm CV theo 9 chiều sau khi bạn bấm Phân tích.'}
          </p>
        </div>
        {hasAnalyzed && (
          <button
            type="button"
            onClick={resetToAiScores}
            aria-label="Reset slider về điểm AI gợi ý"
            aria-live="polite"
            className={`self-start rounded-full border px-4 py-1 text-label-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40 md:self-auto ${
              resetFlash
                ? 'border-on-tertiary-container/40 bg-tertiary-container text-on-tertiary-container'
                : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {resetFlash ? '✓ Đã reset về điểm AI' : 'Reset về điểm AI'}
          </button>
        )}
      </header>

      <FormField label="Ngôn ngữ output" htmlFor="language">
        <Select
          id="language"
          options={languageOptions}
          value={language}
          onChange={(e) => setField('language', e.target.value as Language)}
        />
      </FormField>

      {!hasAnalyzed && (
        <div className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <span className="material-symbols-outlined text-on-tertiary-container" aria-hidden="true">
            info
          </span>
          <div>
            <p className="text-label-md font-bold text-on-surface">
              Sliders sẽ kích hoạt sau phân tích
            </p>
            <p className="text-label-sm text-on-surface-variant">
              AI sẽ chấm CV của bạn theo 9 chiều cho vai trò mục tiêu. Sau khi có
              kết quả, kéo slider để override điểm AI — điểm tổng tính lại tức thì.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
        {SLIDERS.map((s) => (
          <SliderCell
            key={s.key}
            label={s.label}
            value={weights[s.key]}
            onValueChange={(v) => setWeight(s.key, v)}
            description={s.description}
            disabled={!hasAnalyzed}
          />
        ))}
      </div>
    </Card>
  );
}
