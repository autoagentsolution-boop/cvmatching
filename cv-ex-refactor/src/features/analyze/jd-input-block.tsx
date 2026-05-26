'use client';

import { useState } from 'react';
import { MdLink } from 'react-icons/md';
import { Button, Card, DropZone, ErrorState, FormField, Input, Textarea } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { callScrapeJd } from './api-client';
import { parseFile } from './file-parsers';

export function JdInputBlock() {
  const { jdText, jdUrl, setField } = useAnalysis();
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedFileName, setParsedFileName] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [isScraping, setIsScraping] = useState(false);

  async function handleJdFile(file: File) {
    setParseError(null);
    setParsedFileName(null);
    try {
      const text = await parseFile(file);
      setField('jdText', text);
      setParsedFileName(file.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'File parsing failed.');
    }
  }

  async function handleScrape() {
    if (!jdUrl.trim()) return;
    setScrapeError(null);
    setIsScraping(true);
    try {
      const text = await callScrapeJd(jdUrl.trim());
      setField('jdText', text);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Scrape failed.');
    } finally {
      setIsScraping(false);
    }
  }

  return (
    <Card padding="md" className="flex flex-col gap-5">
      <h2 className="text-label-md font-medium text-on-surface">Job Description</h2>

      <FormField label="Job posting URL" htmlFor="jd-url" optional>
        <div className="flex gap-2">
          <Input
            id="jd-url"
            type="url"
            placeholder="https://…"
            leadingIcon={<MdLink size={18} aria-hidden="true" />}
            value={jdUrl}
            onChange={(e) => setField('jdUrl', e.target.value)}
            className="flex-1"
          />
          <Button
            variant="secondary"
            size="md"
            loading={isScraping}
            disabled={!jdUrl.trim()}
            onClick={handleScrape}
          >
            Scrape
          </Button>
        </div>
      </FormField>

      {scrapeError && (
        <ErrorState
          title="Could not scrape URL"
          description={scrapeError}
          retry={handleScrape}
          className="py-6"
        />
      )}

      <DropZone
        title="Or upload JD file"
        subtitle="Accepts .txt, .docx, .pdf · max 4 MB"
        accept=".txt,.docx,.pdf"
        maxSizeMb={4}
        onFile={handleJdFile}
      />

      {parseError && (
        <p className="text-label-sm text-error" role="alert">
          {parseError}
        </p>
      )}

      {parsedFileName && !parseError && (
        <p className="text-label-sm text-on-surface-variant">Loaded: {parsedFileName}</p>
      )}

      <FormField label="Job description text" htmlFor="jd-text">
        <Textarea
          id="jd-text"
          placeholder="Paste the full job description here…"
          rows={10}
          value={jdText}
          onChange={(e) => setField('jdText', e.target.value)}
        />
        <p className="mt-1 text-label-sm text-on-surface-variant">
          {jdText.length} characters
        </p>
      </FormField>
    </Card>
  );
}
