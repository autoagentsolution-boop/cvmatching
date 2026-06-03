'use client';

import { useState } from 'react';
import { Button, Card, FormField, Select, Textarea } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { callGenerateCv } from '@/features/analyze/api-client';
import type { GenerateCvRequest } from '@/features/analyze/types';

const TONE_OPTIONS: SelectOption[] = [
  { value: 'impact', label: 'Impact-focused' },
  { value: 'recruiter', label: 'Recruiter-friendly' },
  { value: 'executive', label: 'Executive' },
  { value: 'concise', label: 'Concise' },
];

const LENGTH_OPTIONS: SelectOption[] = [
  { value: 'short', label: 'Brief' },
  { value: 'medium', label: 'Standard' },
  { value: 'long', label: 'Detailed' },
];

type Tone = GenerateCvRequest['inputs']['tone'];
type Length = GenerateCvRequest['inputs']['length'];

export function RefineToolsBlock() {
  const [tone, setTone] = useState<Tone>('impact');
  const [length, setLength] = useState<Length>('medium');
  const [extraInstructions, setExtraInstructions] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { result, jdText, cvText, language, isGeneratingCv, setField } = useAnalysis();
  const { provider, model, temperature, baseUrl } = useSettings();

  const canRegenerate = result !== null && !isGeneratingCv;

  async function handleRegenerate() {
    if (!result) return;
    setLocalError(null);
    setField('isGeneratingCv', true);

    const llm: GenerateCvRequest['llm'] = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
    };

    const payload: GenerateCvRequest = {
      llm,
      inputs: {
        jdText,
        cvText,
        language,
        tone,
        length,
        ...(extraInstructions.trim() ? { extraInstructions: extraInstructions.trim() } : {}),
      },
      analysisSummary: result.summary,
    };

    try {
      const { markdown, refineNotes } = await callGenerateCv(payload);
      setField('matchedCv', markdown);
      setField('refineNotes', refineNotes);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Regeneration failed.');
    } finally {
      setField('isGeneratingCv', false);
    }
  }

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <h2 className="font-display text-headline-sm text-on-surface">Refine Controls</h2>

      <FormField label="Tone" htmlFor="refine-tone">
        <Select
          id="refine-tone"
          options={TONE_OPTIONS}
          value={tone}
          onChange={(e) => setTone(e.target.value as Tone)}
          disabled={!canRegenerate}
        />
      </FormField>

      <FormField label="Length" htmlFor="refine-length">
        <Select
          id="refine-length"
          options={LENGTH_OPTIONS}
          value={length}
          onChange={(e) => setLength(e.target.value as Length)}
          disabled={!canRegenerate}
        />
      </FormField>

      <FormField label="Extra instructions" htmlFor="refine-extra">
        <Textarea
          id="refine-extra"
          rows={3}
          placeholder="e.g. Emphasise leadership experience..."
          value={extraInstructions}
          onChange={(e) => setExtraInstructions(e.target.value)}
          disabled={!canRegenerate}
        />
      </FormField>

      {localError && (
        <p className="text-body-sm text-error" role="alert">{localError}</p>
      )}

      <Button
        variant="primary"
        size="md"
        fullWidth
        loading={isGeneratingCv}
        disabled={!canRegenerate}
        onClick={handleRegenerate}
      >
        {isGeneratingCv ? 'Regenerating…' : 'Regenerate'}
      </Button>
    </Card>
  );
}
