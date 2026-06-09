'use client';

import { useRef, useState, type ReactNode } from 'react';
import { MdContentPaste, MdLink, MdUploadFile } from 'react-icons/md';
import { Button, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAnalysis } from '@/features/analyze/analysis-store';

type ImportTab = 'paste' | 'url' | 'upload';

const TABS: { id: ImportTab; label: string; icon: ReactNode }[] = [
  { id: 'paste', label: 'Paste', icon: <MdContentPaste size={14} aria-hidden="true" /> },
  { id: 'url', label: 'URL', icon: <MdLink size={14} aria-hidden="true" /> },
  { id: 'upload', label: 'Upload', icon: <MdUploadFile size={14} aria-hidden="true" /> },
];

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT_EXT = '.pdf,.docx,.txt';

/**
 * JdImportPanel — three-mode import (paste / URL / upload) writing parsed JD
 * text + meta into the analysis store. JdSourceCard (left source rail) and
 * JdMatchingContent (right panel "Run Match") both consume the store state.
 *
 * URL + file modes hit /api/import/jd which returns normalized text;
 * uploads additionally create an object URL so the Source JD viewer can
 * render the original PDF inline (mirrors Source CV behavior).
 */
export function JdImportPanel() {
  const jdText = useAnalysis((s) => s.jdText);
  const setField = useAnalysis((s) => s.setField);

  const [tab, setTab] = useState<ImportTab>('paste');
  const [urlInput, setUrlInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function resetSourceMeta() {
    setField('jdMime', null);
    setField('jdOriginalBlobUrl', null);
    setFileName(null);
  }

  function handlePasteChange(value: string) {
    setField('jdText', value);
    // Paste invalidates any previously-imported file preview.
    if (value !== jdText) resetSourceMeta();
  }

  async function handleUrlImport() {
    const url = urlInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError('URL must start with http:// or https://');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/import/jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        const message = (body as { error?: { message?: string } }).error?.message ?? 'Import failed.';
        setError(message);
        return;
      }
      setField('jdText', body.text);
      setField('jdUrl', url);
      resetSourceMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  async function handleFileImport(file: File) {
    if (file.size === 0) {
      setError('File is empty.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File too large (limit ${MAX_BYTES / (1024 * 1024)} MB).`);
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/import/jd', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        const message = (body as { error?: { message?: string } }).error?.message ?? 'Import failed.';
        setError(message);
        return;
      }
      setField('jdText', body.text);
      setField('jdMime', file.type || null);
      setFileName(file.name);

      // PDF preview via object URL. DOCX/TXT fall through to styled text
      // render (mammoth conversion deferred — text-only is readable enough).
      if (file.type === 'application/pdf') {
        // Revoke previous blob to avoid leaks on repeat uploads.
        const prev = useAnalysis.getState().jdOriginalBlobUrl;
        if (prev) URL.revokeObjectURL(prev);
        setField('jdOriginalBlobUrl', URL.createObjectURL(file));
      } else {
        setField('jdOriginalBlobUrl', null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tab switcher */}
      <div
        className="flex rounded-lg border border-outline-variant overflow-hidden"
        role="tablist"
        aria-label="JD import mode"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-label-sm font-semibold transition-colors',
              tab === t.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      {tab === 'paste' && (
        <>
          <Textarea
            value={jdText}
            onChange={(e) => handlePasteChange(e.target.value)}
            rows={10}
            placeholder="Paste the full job description here…"
            aria-label="Job description"
          />
          <p className="text-label-sm text-on-surface-variant">
            {jdText.trim().length} / 50 min characters
          </p>
        </>
      )}

      {tab === 'url' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="jd-url" className="text-label-sm font-semibold text-on-surface">
            Job posting URL
          </label>
          <div className="flex gap-2">
            <input
              id="jd-url"
              type="url"
              inputMode="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://company.com/careers/senior-data-engineer"
              className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <Button
              variant="secondary"
              size="sm"
              loading={importing}
              onClick={() => void handleUrlImport()}
              disabled={!urlInput.trim()}
            >
              Fetch
            </Button>
          </div>
          {jdText && (
            <p className="text-label-sm text-on-surface-variant">
              Imported {jdText.length.toLocaleString('en-US')} characters.
            </p>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low px-4 py-6 text-center transition-colors hover:border-primary hover:bg-surface-container"
          >
            <MdUploadFile size={28} className="text-on-surface-variant" aria-hidden="true" />
            <span className="text-body-sm font-semibold text-on-surface">
              {fileName ?? 'Click to select PDF, DOCX, or TXT'}
            </span>
            <span className="text-label-sm text-on-surface-variant">
              Max {MAX_BYTES / (1024 * 1024)} MB
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_EXT}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileImport(file);
              // Clear the input so re-selecting the same file fires onChange.
              e.target.value = '';
            }}
          />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-error-container px-3 py-2 text-label-sm text-on-error-container">
          {error}
        </p>
      )}
    </div>
  );
}
