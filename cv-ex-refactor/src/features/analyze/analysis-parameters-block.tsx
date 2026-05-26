'use client';

import { useState } from 'react';
import { Badge, Card, Slider } from '@/components/ui';
import { useAnalysis } from './analysis-store';

type Preset = 'Standard' | 'ATS-First' | 'Human-Centric';

const PRESETS: Record<Preset, { keywordMatch: number; experienceDepth: number; softSkills: number }> = {
  Standard:       { keywordMatch: 50, experienceDepth: 50, softSkills: 50 },
  'ATS-First':    { keywordMatch: 80, experienceDepth: 40, softSkills: 20 },
  'Human-Centric':{ keywordMatch: 30, experienceDepth: 60, softSkills: 70 },
};

const PRESET_ORDER: Preset[] = ['Standard', 'ATS-First', 'Human-Centric'];

function nextPreset(current: Preset): Preset {
  const idx = PRESET_ORDER.indexOf(current);
  return PRESET_ORDER[(idx + 1) % PRESET_ORDER.length] ?? 'Standard';
}

function resolvePreset(
  weights: { keywordMatch: number; experienceDepth: number; softSkills: number },
): Preset | null {
  for (const [name, vals] of Object.entries(PRESETS) as [Preset, typeof PRESETS[Preset]][]) {
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

export function AnalysisParametersBlock() {
  const { weights, setField } = useAnalysis();
  // Visual-only checkboxes — wired to local state; not in global store (KISS per spec)
  const [includeKeywords, setIncludeKeywords] = useState(true);
  const [includeMarket, setIncludeMarket] = useState(false);

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
    <Card padding="md" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-label-md font-medium text-on-surface">Analysis weights</h2>
        <button
          type="button"
          onClick={applyPreset}
          aria-label="Cycle scoring preset"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40 rounded-full"
        >
          <Badge variant={activePreset ? 'secondary' : 'neutral'} size="sm">
            {activePreset ?? 'Custom'}
          </Badge>
        </button>
      </div>

      <Slider
        label="Keyword match"
        value={[weights.keywordMatch]}
        onValueChange={([v]) => v !== undefined && setWeight('keywordMatch', v)}
        min={0}
        max={100}
        aria-label="Keyword match weight"
      />

      <Slider
        label="Experience depth"
        value={[weights.experienceDepth]}
        onValueChange={([v]) => v !== undefined && setWeight('experienceDepth', v)}
        min={0}
        max={100}
        aria-label="Experience depth weight"
      />

      <Slider
        label="Soft skills"
        value={[weights.softSkills]}
        onValueChange={([v]) => v !== undefined && setWeight('softSkills', v)}
        min={0}
        max={100}
        aria-label="Soft skills weight"
      />

      <div className="flex flex-col gap-3 border-t border-outline-variant pt-4">
        <label className="flex cursor-pointer items-center gap-2.5 text-label-md text-on-surface-variant">
          <input
            type="checkbox"
            checked={includeKeywords}
            onChange={(e) => setIncludeKeywords(e.target.checked)}
            className="h-4 w-4 rounded border-outline-variant accent-on-tertiary-container"
          />
          Include keyword extraction
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-label-md text-on-surface-variant">
          <input
            type="checkbox"
            checked={includeMarket}
            onChange={(e) => setIncludeMarket(e.target.checked)}
            className="h-4 w-4 rounded border-outline-variant accent-on-tertiary-container"
          />
          Include market benchmark
        </label>
      </div>
    </Card>
  );
}
