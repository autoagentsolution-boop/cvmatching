'use client';

import { useState } from 'react';
import { MdLink, MdClose } from 'react-icons/md';
import { Button, Card, DropZone, ErrorState, Input, Textarea } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import { callScrapeJd } from './api-client';
import { parseFile } from './file-parsers';

export function JdInputBlock() {
  const { jdText, jdUrl, setField } = useAnalysis();
  const [urlExpanded, setUrlExpanded] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedFileName, setParsedFileName] = useState<string | null>(null);

  async function handleScrape() {
    if (!jdUrl.trim()) return;
    setScrapeError(null);
    setIsScraping(true);
    try {
      const text = await callScrapeJd(jdUrl.trim());
      setField('jdText', text);
      setUrlExpanded(false);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Scrape failed.');
    } finally {
      setIsScraping(false);
    }
  }

  function handleCancel() {
    setUrlExpanded(false);
    setScrapeError(null);
    setField('jdUrl', '');
  }

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

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <span className="text-label-md font-bold uppercase tracking-wide text-primary">
          2. Job Description
        </span>
        {!urlExpanded && (
          <button
            type="button"
            onClick={() => setUrlExpanded(true)}
            className="flex items-center gap-1 text-label-sm font-medium text-on-tertiary-container hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40 rounded"
          >
            <MdLink size={14} aria-hidden="true" />
            Paste URL instead
          </button>
        )}
      </header>

      {urlExpanded && (
        <div className="flex items-center gap-2">
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
          <Button
            variant="ghost"
            size="md"
            aria-label="Cancel URL input"
            onClick={handleCancel}
          >
            <MdClose size={18} aria-hidden="true" />
          </Button>
        </div>
      )}

      {scrapeError && (
        <ErrorState
          title="Could not scrape URL"
          description={scrapeError}
          retry={handleScrape}
          className="py-4"
        />
      )}

      <DropZone
        title="Upload JD file"
        subtitle="Parsed content appears in the box below — .txt, .docx, .pdf"
        accept=".txt,.docx,.pdf"
        maxSizeMb={4}
        onFile={handleJdFile}
      />

      {parseError && (
        <p className="text-label-sm text-error" role="alert">{parseError}</p>
      )}
      {parsedFileName && !parseError && (
        <p className="text-label-sm text-on-surface-variant">Loaded: {parsedFileName}</p>
      )}

      <Card padding="md" className="flex flex-col gap-4">
        <Textarea
          id="jd-text"
          aria-label="Job description"
          placeholder="Paste the job requirements, responsibilities, and qualifications here — or upload a file above…"
          rows={10}
          value={jdText}
          onChange={(e) => setField('jdText', e.target.value)}
        />
        <div className="flex items-center justify-between border-t border-outline-variant pt-3">
          <span className="text-label-sm text-on-surface-variant">
            Recommended 100+ words for better accuracy
          </span>
          <span className="text-label-sm text-on-surface-variant">
            {jdText.length} chars
          </span>
        </div>
      </Card>
    </section>
  );
}
