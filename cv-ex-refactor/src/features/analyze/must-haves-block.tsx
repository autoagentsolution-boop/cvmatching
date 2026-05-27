'use client';

import { useCallback, useEffect, useRef } from 'react';
import { MdClose, MdRefresh } from 'react-icons/md';
import { Badge, Button, ErrorState, LoadingState } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { useSettings } from './settings-store';
import { callExtractMustHaves } from './api-client';
import type { AnalyzeRequestLLM } from './types';

const MIN_JD_LENGTH = 80;

export function MustHavesBlock() {
  const {
    jdText,
    language,
    mustHaves,
    isExtractingMustHaves,
    mustHavesError,
    setField,
  } = useAnalysis();
  const { useSharedKey, provider, model, temperature, baseUrl, apiKey } = useSettings();

  const lastExtractedRef = useRef<string>('');

  const runExtract = useCallback(async () => {
    if (jdText.trim().length < MIN_JD_LENGTH) return;
    setField('mustHavesError', null);
    setField('isExtractingMustHaves', true);
    const llm: AnalyzeRequestLLM = useSharedKey
      ? { provider, model, temperature }
      : {
          provider,
          model,
          temperature,
          ...(baseUrl ? { baseUrl } : {}),
          ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}),
        };
    try {
      const result = await callExtractMustHaves(jdText, llm, language);
      setField('mustHaves', result);
      lastExtractedRef.current = jdText;
    } catch (err) {
      setField(
        'mustHavesError',
        err instanceof Error ? err.message : 'Could not extract must-haves.',
      );
    } finally {
      setField('isExtractingMustHaves', false);
    }
  }, [jdText, language, useSharedKey, provider, model, temperature, baseUrl, apiKey, setField]);

  // Auto-fire once when JD becomes long enough and we have no extraction yet.
  useEffect(() => {
    if (
      jdText.trim().length >= MIN_JD_LENGTH &&
      mustHaves.length === 0 &&
      !isExtractingMustHaves &&
      !mustHavesError &&
      lastExtractedRef.current !== jdText
    ) {
      runExtract();
    }
  }, [jdText, mustHaves.length, isExtractingMustHaves, mustHavesError, runExtract]);

  function removeChip(value: string) {
    setField(
      'mustHaves',
      mustHaves.filter((m) => m !== value),
    );
  }

  return (
    <section
      aria-labelledby="must-haves-heading"
      className="flex flex-col gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4
            id="must-haves-heading"
            className="text-label-md font-bold uppercase tracking-wide text-primary"
          >
            Must-have requirements
          </h4>
          {mustHaves.length > 0 && (
            <Badge variant="neutral" size="sm">
              {mustHaves.length} found
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={isExtractingMustHaves}
          disabled={jdText.trim().length < MIN_JD_LENGTH}
          leadingIcon={<MdRefresh size={16} aria-hidden="true" />}
          onClick={runExtract}
        >
          {mustHaves.length > 0 ? 'Re-extract' : 'Extract from JD'}
        </Button>
      </header>

      <p className="text-label-sm text-on-surface-variant">
        Hard-gate requirements parsed from the JD. Missing any one caps the
        decision at <span className="font-bold text-on-tertiary-container">stretch</span>.
      </p>

      {isExtractingMustHaves && mustHaves.length === 0 && (
        <LoadingState variant="spinner" message="Extracting must-haves from JD…" />
      )}

      {mustHavesError && (
        <ErrorState
          title="Could not extract must-haves"
          description={mustHavesError}
          retry={runExtract}
          className="py-3"
        />
      )}

      {!isExtractingMustHaves && !mustHavesError && mustHaves.length === 0 &&
        jdText.trim().length < MIN_JD_LENGTH && (
          <p className="text-label-sm text-on-surface-variant/70">
            Paste a job description above ({MIN_JD_LENGTH}+ characters) to extract
            requirements automatically.
          </p>
        )}

      {mustHaves.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Must-have requirements list">
          {mustHaves.map((item) => (
            <li key={item}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 text-label-sm text-on-surface">
                {item}
                <button
                  type="button"
                  onClick={() => removeChip(item)}
                  aria-label={`Remove must-have: ${item}`}
                  className="rounded-full p-0.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40"
                >
                  <MdClose size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
