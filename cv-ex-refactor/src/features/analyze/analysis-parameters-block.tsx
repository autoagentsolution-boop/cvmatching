'use client';

import { useState } from 'react';
import { Card, Checkbox, FormField, Select, Slider } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import type { Language, RoleFamily, Strictness } from './types';

type Preset = 'Standard' | 'ATS-First' | 'Human-Centric';

const PRESETS: Record<Preset, { keywordMatch: number; experienceDepth: number; softSkills: number }> = {
  Standard:        { keywordMatch: 50, experienceDepth: 50, softSkills: 50 },
  'ATS-First':     { keywordMatch: 80, experienceDepth: 40, softSkills: 20 },
  'Human-Centric': { keywordMatch: 30, experienceDepth: 60, softSkills: 70 },
};

const PRESET_ORDER: Preset[] = ['Standard', 'ATS-First', 'Human-Centric'];

const roleFamilyOptions: SelectOption[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'data_engineer', label: 'Data Engineer' },
  { value: 'data_platform', label: 'Data Platform' },
  { value: 'manager', label: 'Engineering Manager' },
  { value: 'pm_delivery', label: 'PM / Delivery' },
  { value: 'solution', label: 'Solutions Architect' },
  { value: 'software', label: 'Software Engineer' },
  { value: 'other', label: 'Other' },
];

const strictnessOptions: SelectOption[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'strict', label: 'Strict (recruiter-grade)' },
  { value: 'friendly', label: 'Friendly (encouraging)' },
];

const languageOptions: SelectOption[] = [
  { value: 'auto', label: 'Match JD language' },
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Vietnamese' },
];

function nextPreset(current: Preset): Preset {
  const idx = PRESET_ORDER.indexOf(current);
  return PRESET_ORDER[(idx + 1) % PRESET_ORDER.length] ?? 'Standard';
}

function resolvePreset(
  weights: { keywordMatch: number; experienceDepth: number; softSkills: number },
): Preset | null {
  for (const [name, vals] of Object.entries(PRESETS) as [Preset, (typeof PRESETS)[Preset]][]) {
    if (
      vals.keywordMatch === weights.keywordMatch &&
      vals.experienceDepth === weights.experienceDepth &&
      vals.softSkills === weights.softSkills
    ) {
      return name;
    }
  }
  return null;
}

interface SliderCellProps {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  description: string;
}

function SliderCell({ label, value, onValueChange, description }: SliderCellProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-label-md font-bold text-primary">{label}</span>
        <span className="text-label-sm font-bold text-on-tertiary-container">{value}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => v !== undefined && onValueChange(v)}
        min={0}
        max={100}
        aria-label={label}
      />
      <p className="text-label-sm text-on-surface-variant">{description}</p>
    </div>
  );
}

export function AnalysisParametersBlock() {
  const { weights, targetRole, strictness, language, setField } = useAnalysis();

  const [benchmarks, setBenchmarks] = useState(true);
  const [atsCheck, setAtsCheck] = useState(false);
  const [actionVerbs, setActionVerbs] = useState(true);

  const activePreset = resolvePreset(weights);

  function applyPreset() {
    const current: Preset = activePreset ?? 'Standard';
    const next = nextPreset(current);
    setField('weights', PRESETS[next]);
  }

  function setWeight(key: keyof typeof weights, val: number) {
    setField('weights', { ...weights, [key]: val });
  }

  return (
    <Card padding="lg" className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-headline-md font-bold text-primary">3. Analysis Parameters</h3>
          <p className="text-body-md text-on-surface-variant">
            Adjust how the AI weighs different sections of your profile.
          </p>
        </div>
        <button
          type="button"
          onClick={applyPreset}
          aria-label="Cycle scoring preset"
          className="self-start rounded-full border border-outline-variant bg-surface-container-low px-4 py-1 text-label-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40 md:self-auto"
        >
          Preset: {activePreset ?? 'Custom'}
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <FormField label="Target role" htmlFor="target-role">
          <Select
            id="target-role"
            options={roleFamilyOptions}
            value={targetRole}
            onChange={(e) => setField('targetRole', e.target.value as RoleFamily)}
          />
        </FormField>
        <FormField label="Strictness" htmlFor="strictness">
          <Select
            id="strictness"
            options={strictnessOptions}
            value={strictness}
            onChange={(e) => setField('strictness', e.target.value as Strictness)}
          />
        </FormField>
        <FormField label="Output language" htmlFor="language">
          <Select
            id="language"
            options={languageOptions}
            value={language}
            onChange={(e) => setField('language', e.target.value as Language)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <SliderCell
          label="Keyword Match"
          value={weights.keywordMatch}
          onValueChange={(v) => setWeight('keywordMatch', v)}
          description="Prioritize technical terms and specific tools mentioned in the JD."
        />
        <SliderCell
          label="Experience Depth"
          value={weights.experienceDepth}
          onValueChange={(v) => setWeight('experienceDepth', v)}
          description="Evaluate seniority alignment and length of tenure in relevant roles."
        />
        <SliderCell
          label="Soft Skills / Culture"
          value={weights.softSkills}
          onValueChange={(v) => setWeight('softSkills', v)}
          description="Extract behavioral traits and collaborative indicators from your story."
        />
      </div>

      <div className="flex flex-wrap gap-6 border-t border-outline-variant pt-6">
        <Checkbox
          label="Compare with industry benchmarks"
          checked={benchmarks}
          onCheckedChange={setBenchmarks}
        />
        <Checkbox
          label="Check for ATS readability issues"
          checked={atsCheck}
          onCheckedChange={setAtsCheck}
        />
        <Checkbox
          label="AI-Suggested action verbs"
          checked={actionVerbs}
          onCheckedChange={setActionVerbs}
        />
      </div>
    </Card>
  );
}
