'use client';

import { useState } from 'react';
import { MdPerson } from 'react-icons/md';
import { Card, DropZone, FormField, Select, Textarea } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { parseFile } from './file-parsers';
import type { RoleFamily, Strictness, Language } from './types';

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

export function CvInputBlock() {
  const { cvText, profileText, targetRole, strictness, language, setField } = useAnalysis();
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
    <Card padding="md" className="flex flex-col gap-5">
      <h2 className="text-label-md font-medium text-on-surface">Your CV</h2>

      <DropZone
        title="Upload your CV"
        subtitle="Accepts .txt, .docx, .pdf · max 4 MB"
        accept=".txt,.docx,.pdf"
        maxSizeMb={4}
        onFile={handleCvFile}
      />

      {parseError && (
        <p className="text-label-sm text-error" role="alert">
          {parseError}
        </p>
      )}

      {parsedFileName && !parseError && (
        <p className="text-label-sm text-on-surface-variant">
          Loaded: {parsedFileName}
        </p>
      )}

      <FormField label="CV text" htmlFor="cv-text" optional>
        <Textarea
          id="cv-text"
          placeholder="Or paste your CV here…"
          rows={8}
          value={cvText}
          onChange={(e) => setField('cvText', e.target.value)}
        />
      </FormField>

      <FormField label="Real experience notes" htmlFor="profile-text" optional>
        <Textarea
          id="profile-text"
          placeholder="Additional context not in your CV — helps distinguish wording gaps from real gaps."
          rows={4}
          value={profileText}
          onChange={(e) => setField('profileText', e.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      <p className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
        <MdPerson size={14} aria-hidden="true" />
        CV text stays in your browser — never sent to analytics.
      </p>
    </Card>
  );
}
