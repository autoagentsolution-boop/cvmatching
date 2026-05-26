'use client';

import { useState } from 'react';
import { Card, DropZone, FormField, Textarea } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { parseFile } from './file-parsers';

export function CvInputBlock() {
  const { cvText, profileText, setField } = useAnalysis();
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedFileName, setParsedFileName] = useState<string | null>(null);

  async function handleCvFile(file: File) {
    setParseError(null);
    setParsedFileName(null);
    try {
      const text = await parseFile(file);
      setField('cvText', text);
      setParsedFileName(file.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'File parsing failed.');
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <span className="text-label-md font-bold uppercase tracking-wide text-primary">
          1. Your Resume / CV
        </span>
        <span className="rounded bg-surface-container-highest px-2 py-1 text-label-sm text-on-surface-variant">
          PDF, DOCX supported
        </span>
      </header>

      <DropZone
        title="Drop your resume here"
        subtitle="or click to browse your computer"
        accept=".txt,.docx,.pdf"
        maxSizeMb={4}
        onFile={handleCvFile}
        className="min-h-[200px]"
      />

      {parseError && (
        <p className="text-label-sm text-error" role="alert">{parseError}</p>
      )}
      {parsedFileName && !parseError && (
        <p className="text-label-sm text-on-surface-variant">Loaded: {parsedFileName}</p>
      )}

      <Card padding="md" className="flex flex-col gap-4">
        <FormField label="Or paste your CV text" htmlFor="cv-text" optional>
          <Textarea
            id="cv-text"
            placeholder="Paste your CV content here…"
            rows={6}
            value={cvText}
            onChange={(e) => setField('cvText', e.target.value)}
          />
        </FormField>

        <FormField label="Additional context" htmlFor="profile-text" optional>
          <Textarea
            id="profile-text"
            placeholder="Extra notes, certifications, or context that may not appear in your CV…"
            rows={3}
            value={profileText}
            onChange={(e) => setField('profileText', e.target.value)}
          />
        </FormField>
      </Card>
    </section>
  );
}
