'use client';

import { useState } from 'react';
import { Card, Checkbox, FormField, Select, Slider } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { MustHavesBlock } from './must-haves-block';
import { hydrateWeightsFromResult } from '@/lib/scoring/recompute-overall';
import type { Language, RoleFamily, Strictness, Weights } from './types';

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
    key: 'coreSkill',
    label: 'Core Skill Match',
    description: 'Core competencies the role demands (e.g. system design, data modeling).',
  },
  {
    key: 'tool',
    label: 'Tool / Platform',
    description: 'Concrete tools, frameworks, and platforms named in the JD.',
  },
  {
    key: 'scope',
    label: 'Scope Match',
    description: 'Has owned the same kind of scope — team size, IC vs lead, greenfield vs ops.',
  },
  {
    key: 'production',
    label: 'Production Experience',
    description: 'Real live systems, real users, business-critical environments.',
  },
  {
    key: 'domain',
    label: 'Domain / Industry',
    description: 'Relevant industry context — fintech, ad-tech, healthcare, etc.',
  },
  {
    key: 'evidence',
    label: 'Evidence Strength',
    description: 'Concrete projects, roles, dates, ownership — not just buzzwords.',
  },
  {
    key: 'seniority',
    label: 'Seniority / Ownership',
    description: 'Level, years, decision-making authority, ownership depth.',
  },
  {
    key: 'impact',
    label: 'Impact / Achievement',
    description: 'Magnitude of outcomes — metrics, scale, business results.',
  },
  {
    key: 'communication',
    label: 'Communication Fit',
    description: 'Stakeholder collaboration, business acumen, and soft skills.',
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
  const { weights, targetRole, strictness, language, result, setField } = useAnalysis();

  const [benchmarks, setBenchmarks] = useState(true);
  const [atsCheck, setAtsCheck] = useState(false);
  const [actionVerbs, setActionVerbs] = useState(true);

  const hasAnalyzed = result !== null;

  function setWeight(key: keyof Weights, val: number) {
    setField('weights', { ...weights, [key]: val });
  }

  function resetToAiScores() {
    if (!result) return;
    setField('weights', hydrateWeightsFromResult(result));
  }

  return (
    <Card padding="lg" className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-headline-md font-bold text-primary">3. Analysis Parameters</h3>
          <p className="text-body-md text-on-surface-variant">
            {hasAnalyzed
              ? 'AI scored your CV on 9 dimensions. Adjust if you disagree — the overall score will recompute.'
              : 'AI will score your CV on 9 dimensions after you click Analyze.'}
          </p>
        </div>
        {hasAnalyzed && (
          <button
            type="button"
            onClick={resetToAiScores}
            aria-label="Reset slider values to AI-suggested scores"
            className="self-start rounded-full border border-outline-variant bg-surface-container-low px-4 py-1 text-label-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40 md:self-auto"
          >
            Reset to AI scores
          </button>
        )}
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

      {!hasAnalyzed && (
        <div className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <span className="material-symbols-outlined text-on-tertiary-container" aria-hidden="true">
            info
          </span>
          <div>
            <p className="text-label-md font-bold text-on-surface">
              Sliders activate after analysis
            </p>
            <p className="text-label-sm text-on-surface-variant">
              The AI will score your CV against the JD on 9 dimensions. After analysis, drag any
              slider to override the AI&apos;s score — overall match recomputes instantly.
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
