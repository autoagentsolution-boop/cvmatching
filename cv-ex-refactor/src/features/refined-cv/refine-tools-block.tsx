'use client';

import { useState } from 'react';
import { Button, Card, FormField, Select, Textarea } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { callGenerateCv, callGenerateCvV3 } from '@/features/analyze/api-client';
import { buildV3Findings } from '@/features/analyze/build-v3-findings';
import type { GenerateCvRequest } from '@/features/analyze/types';
import { useResolvedSource, useSourceData, useSourceSetters } from './use-source-resolver';

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

type Tone = NonNullable<GenerateCvRequest['inputs']['tone']>;
type Length = NonNullable<GenerateCvRequest['inputs']['length']>;

export function RefineToolsBlock() {
  const [tone, setTone] = useState<Tone>('impact');
  const [length, setLength] = useState<Length>('medium');
  const [extraInstructions, setExtraInstructions] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const source = useResolvedSource();
  const { result, cvText } = useSourceData();
  const { setMatchedCv, setRefineNotes } = useSourceSetters(source);
  const { jdText, language, isGeneratingCv, targetRoleConfirmed, setField } = useAnalysis();
  const { provider, model, temperature, baseUrl } = useSettings();

  // Job Fit refine flow lives in RefinedCvModeBanner (it has the Job context).
  // RefineToolsBlock supports only analyze + jd-matching sources.
  const canRegenerate = result !== null && !isGeneratingCv && (source === 'analyze' || source === 'jd-matching');

  async function handleRegenerate() {
    if (!result || (source !== 'analyze' && source !== 'jd-matching')) return;
    setLocalError(null);
    setField('isGeneratingCv', true);

    const llm: GenerateCvRequest['llm'] = {
      provider,
      model,
      temperature,
      ...(baseUrl ? { baseUrl } : {}),
    };

    try {
      let markdown: string;
      let refineNotes: string | null;

      if (source === 'analyze') {
        const findings = buildV3Findings(result, targetRoleConfirmed ?? '');
        const res = await callGenerateCvV3({
          llm,
          cvText,
          language,
          findings,
          tone,
          length,
          ...(extraInstructions.trim() ? { extraInstructions: extraInstructions.trim() } : {}),
        });
        markdown = res.markdown;
        refineNotes = res.refineNotes;
      } else {
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
        const res = await callGenerateCv(payload);
        markdown = res.markdown;
        refineNotes = res.refineNotes;
      }

      setMatchedCv(markdown);
      setRefineNotes(refineNotes);
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
