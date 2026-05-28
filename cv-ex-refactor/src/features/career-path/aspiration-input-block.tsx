'use client';

import { Card, FormField, Input, Select, Textarea, Badge } from '@/components/ui';
import { useCareerPath } from './career-path-store';
import { FOCUS_AREA_LABELS, type FocusArea, type HorizonYears } from './types';

const HORIZON_OPTIONS = [
  { value: '1', label: '1 year — near term' },
  { value: '3', label: '3 years — mid term' },
  { value: '5', label: '5 years — long term' },
];

const FOCUS_KEYS = Object.keys(FOCUS_AREA_LABELS) as FocusArea[];

export function AspirationInputBlock() {
  const {
    targetRole,
    horizonYears,
    focusAreas,
    industryShift,
    constraints,
    notes,
    isGenerating,
    setField,
    toggleFocus,
  } = useCareerPath();

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <span className="text-label-md font-bold uppercase tracking-wide text-primary">
          Career aspiration
        </span>
        <span className="text-label-sm text-on-surface-variant">
          Tinh chỉnh nếu cần — bỏ trống để AI tự suy luận từ CV
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Target role" htmlFor="cp-target-role" optional>
          <Input
            id="cp-target-role"
            value={targetRole}
            onChange={(e) => setField('targetRole', e.target.value)}
            placeholder="e.g. Staff Data Engineer, EM, PM"
            disabled={isGenerating}
          />
        </FormField>

        <FormField label="Horizon" htmlFor="cp-horizon">
          <Select
            id="cp-horizon"
            options={HORIZON_OPTIONS}
            value={String(horizonYears)}
            onChange={(e) => setField('horizonYears', Number(e.target.value) as HorizonYears)}
            disabled={isGenerating}
          />
        </FormField>
      </div>

      <FormField label="Focus areas" htmlFor="cp-focus" optional>
        <div id="cp-focus" className="flex flex-wrap gap-2">
          {FOCUS_KEYS.map((key) => {
            const active = focusAreas.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleFocus(key)}
                disabled={isGenerating}
                className="focus:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/10 rounded-full"
              >
                <Badge variant={active ? 'primary' : 'neutral'} size="md">
                  {FOCUS_AREA_LABELS[key]}
                </Badge>
              </button>
            );
          })}
        </div>
      </FormField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Industry shift" htmlFor="cp-industry" optional>
          <Input
            id="cp-industry"
            value={industryShift}
            onChange={(e) => setField('industryShift', e.target.value)}
            placeholder="e.g. fintech → climate tech"
            disabled={isGenerating}
          />
        </FormField>

        <FormField label="Constraints" htmlFor="cp-constraints" optional>
          <Input
            id="cp-constraints"
            value={constraints}
            onChange={(e) => setField('constraints', e.target.value)}
            placeholder="e.g. relocate impossible, limited budget"
            disabled={isGenerating}
          />
        </FormField>
      </div>

      <FormField label="Notes for the AI" htmlFor="cp-notes" optional>
        <Textarea
          id="cp-notes"
          value={notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Anything else worth knowing about your direction, learning style, or red lines."
          rows={4}
          disabled={isGenerating}
        />
      </FormField>
    </Card>
  );
}
