'use client';

import { useState } from 'react';
import { Card, Checkbox, FormField, Select, Slider } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { MustHavesBlock } from './must-haves-block';
import type { Language, RoleFamily, Strictness, Weights } from './types';

type Preset = 'Standard' | 'Senior IC' | 'Manager' | 'Junior-friendly' | 'ATS-first';

const PRESETS: Record<Preset, Weights> = {
  Standard:          { technical: 50, production: 50, evidence: 50, seniority: 50, communication: 50, atsKeyword: 50 },
  'Senior IC':       { technical: 70, production: 70, evidence: 80, seniority: 50, communication: 40, atsKeyword: 40 },
  Manager:           { technical: 40, production: 60, evidence: 60, seniority: 80, communication: 80, atsKeyword: 30 },
  'Junior-friendly': { technical: 50, production: 30, evidence: 40, seniority: 20, communication: 60, atsKeyword: 70 },
  'ATS-first':       { technical: 80, production: 50, evidence: 50, seniority: 30, communication: 30, atsKeyword: 90 },
};

const PRESET_ORDER: Preset[] = ['Standard', 'Senior IC', 'Manager', 'Junior-friendly', 'ATS-first'];

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

interface SliderSpec {
  key: keyof Weights;
  label: string;
  description: string;
}

const SLIDERS: SliderSpec[] = [
  {
    key: 'technical',
    label: 'Technical Skills',
    description: 'Tool, framework, and language alignment with the JD requirements.',
  },
  {
    key: 'production',
    label: 'Production Experience',
    description: 'Depth in scaling, ops, and industry context relevant to the role.',
  },
  {
    key: 'evidence',
    label: 'Evidence Strength',
    description: 'Concrete metrics, outcomes, and ownership — not buzzwords.',
  },
  {
    key: 'seniority',
    label: 'Seniority Fit',
    description: 'Level, scope of responsibility, and mentoring or influence span.',
  },
  {
    key: 'communication',
    label: 'Communication Fit',
    description: 'Stakeholder collaboration, business acumen, and soft skills.',
  },
  {
    key: 'atsKeyword',
    label: 'ATS Coverage',
    description: 'Exact keyword matches that pass ATS and HR screening filters.',
  },
];

function nextPreset(current: Preset): Preset {
  const idx = PRESET_ORDER.indexOf(current);
  return PRESET_ORDER[(idx + 1) % PRESET_ORDER.length] ?? 'Standard';
}

function resolvePreset(weights: Weights): Preset | null {
  for (const [name, vals] of Object.entries(PRESETS) as [Preset, Weights][]) {
    const allMatch = (Object.keys(vals) as (keyof Weights)[]).every(
      (k) => vals[k] === weights[k],
    );
    if (allMatch) return name;
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

  function setWeight(key: keyof Weights, val: number) {
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

      <MustHavesBlock />

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
        {SLIDERS.map((s) => (
          <SliderCell
            key={s.key}
            label={s.label}
            value={weights[s.key]}
            onValueChange={(v) => setWeight(s.key, v)}
            description={s.description}
          />
        ))}
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
