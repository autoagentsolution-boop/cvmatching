'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { Drawer, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import type { UserCvRow } from '@/lib/cvs/repo';

interface CvsLibraryClientProps {
  initialCvs: UserCvRow[];
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export function CvsLibraryClient({ initialCvs }: CvsLibraryClientProps) {
  const router = useRouter();
  const [cvs, setCvs] = useState<UserCvRow[]>(initialCvs);
  const [busy, setBusy] = useState<string | null>(null); // cvId being mutated
  const [error, setError] = useState<string | null>(null);

  // Rename state
  const [renameTarget, setRenameTarget] = useState<UserCvRow | null>(null);
  const [renameName, setRenameName] = useState('');

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<UserCvRow | null>(null);

  // Import drawer
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<'paste' | 'upload'>('paste');
  const [importName, setImportName] = useState('');
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function patchCv(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/cvs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: { message?: string } }).error?.message ?? 'Update failed.');
    }
    const body = (await res.json()) as { cv: UserCvRow };
    return body.cv;
  }

  async function deleteCv(id: string) {
    const res = await fetch(`/api/cvs/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: { message?: string } }).error?.message ?? 'Delete failed.');
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSetDefault(cv: UserCvRow) {
    if (cv.isDefault) return;
    setBusy(cv.id);
    setError(null);
    try {
      const updated = await patchCv(cv.id, { isDefault: true });
      setCvs((prev) =>
        prev.map((c) =>
          c.id === updated.id ? updated : { ...c, isDefault: false },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default.');
    } finally {
      setBusy(null);
    }
  }

  async function handleRename() {
    if (!renameTarget || !renameName.trim()) return;
    setBusy(renameTarget.id);
    setError(null);
    try {
      const updated = await patchCv(renameTarget.id, { name: renameName.trim() });
      setCvs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setRenameTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(deleteTarget.id);
    setError(null);
    try {
      await deleteCv(deleteTarget.id);
      setCvs((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete.');
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    setError(null);
    const name = importName.trim() || (importTab === 'upload' && importFile ? importFile.name.replace(/\.[^.]+$/, '') : 'Imported CV');

    setImporting(true);
    try {
      let savedCvId: string;

      if (importTab === 'paste') {
        if (!importText.trim()) { setError('Paste your CV text first.'); return; }
        const res = await fetch('/api/cvs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content: importText.trim() }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: { message?: string } }).error?.message ?? 'Create failed.');
        }
        const body = (await res.json()) as { cv: UserCvRow };
        savedCvId = body.cv.id;
        setCvs((prev) => [body.cv, ...prev]);
      } else {
        if (!importFile) { setError('Select a file first.'); return; }
        const form = new FormData();
        form.append('file', importFile);
        const url = `/api/import/cv?saveToLibrary=true&name=${encodeURIComponent(name)}`;
        const res = await fetch(url, { method: 'POST', body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: { message?: string } }).error?.message ?? 'Import failed.');
        }
        const body = (await res.json()) as { savedCvId?: string };
        savedCvId = body.savedCvId ?? '';
        // Refresh the list from server
        const listRes = await fetch('/api/cvs');
        if (listRes.ok) {
          const listBody = (await listRes.json()) as { cvs: UserCvRow[] };
          setCvs(listBody.cvs);
        }
      }

      // Reset form and close
      setImportText('');
      setImportFile(null);
      setImportName('');
      setShowImport(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Global error banner */}
      {error && (
        <div className="mb-4 rounded-xl border border-error-container bg-error-container px-4 py-3 text-body-sm text-on-error-container flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="shrink-0 text-on-error-container/70 hover:text-on-error-container">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Add CV button */}
      <div className="mb-6 flex justify-end">
        <Button
          variant="primary"
          size="md"
          onClick={() => { setShowImport(true); setImportTab('paste'); }}
          leadingIcon={<span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>}
        >
          New CV
        </Button>
      </div>

      {cvs.length === 0 ? (
        <EmptyState
          icon={<span className="material-symbols-outlined text-[32px]" aria-hidden="true">description</span>}
          title="No CVs yet"
          description="Paste your first CV to get started."
          action={
            <Button variant="primary" onClick={() => setShowImport(true)}>
              Paste your first CV
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cvs.map((cv) => (
            <li key={cv.id}>
              <Card variant="default" padding="md" className="flex flex-col gap-3 h-full">
                {/* Name + default badge */}
                <div className="flex items-start gap-2">
                  <span className="flex-1 font-semibold text-on-surface text-body-md line-clamp-2">
                    {cv.name}
                  </span>
                  {cv.isDefault && (
                    <span className="shrink-0 rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold text-on-tertiary-fixed">
                      Default
                    </span>
                  )}
                </div>

                <p className="text-label-sm text-on-surface-variant">
                  Updated {formatRelative(new Date(cv.updatedAt))}
                </p>

                {/* Quick links */}
                <div className="flex gap-2 mt-auto">
                  <Link
                    href={`/cv-analyze/${cv.id}/score`}
                    className="flex-1 rounded-lg border border-outline-variant py-2 text-center text-label-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    Analyze
                  </Link>
                  <Link
                    href={`/jd-matching/${cv.id}/match`}
                    className="flex-1 rounded-lg border border-outline-variant py-2 text-center text-label-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    Match JD
                  </Link>
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-1 border-t border-outline-variant/50 pt-2 -mx-1">
                  {!cv.isDefault && (
                    <button
                      type="button"
                      disabled={busy === cv.id}
                      onClick={() => handleSetDefault(cv)}
                      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">star</span>
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setRenameTarget(cv); setRenameName(cv.name); }}
                    className="flex items-center gap-1 rounded-md px-2 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">edit</span>
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={busy === cv.id}
                    onClick={() => setDeleteTarget(cv)}
                    className="ml-auto flex items-center gap-1 rounded-md px-2 py-1.5 text-label-sm text-error transition-colors hover:bg-error-container/20 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">delete</span>
                    Delete
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Rename modal */}
      <Modal open={renameTarget !== null} onClose={() => setRenameTarget(null)} title="Rename CV" size="sm">
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(); }}
            maxLength={200}
            placeholder="CV name"
            aria-label="CV name"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={busy === renameTarget?.id} onClick={() => void handleRename()}>
              Save
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Delete CV?" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-body-md text-on-surface-variant">
            <strong className="text-on-surface">{deleteTarget?.name}</strong> will be permanently deleted. This cannot be undone.
          </p>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" loading={busy === deleteTarget?.id} onClick={() => void handleDelete()}>
              Delete
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Import drawer */}
      <Drawer open={showImport} onClose={() => setShowImport(false)} side="right" title="New CV">
        <DrawerHeader>
          <DrawerTitle>Add a CV</DrawerTitle>
        </DrawerHeader>

        {/* Tab switcher */}
        <div className="mb-4 flex rounded-lg border border-outline-variant overflow-hidden">
          {(['paste', 'upload'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setImportTab(tab)}
              className={cn(
                'flex-1 py-2 text-label-md font-semibold transition-colors',
                importTab === tab
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low',
              )}
            >
              {tab === 'paste' ? 'Paste text' : 'Upload file'}
            </button>
          ))}
        </div>

        {/* Name field */}
        <div className="mb-3">
          <label htmlFor="import-cv-name" className="mb-1.5 block text-label-sm font-semibold text-on-surface">
            Name <span className="font-normal text-on-surface-variant">(optional)</span>
          </label>
          <input
            id="import-cv-name"
            type="text"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            placeholder="e.g. Senior Backend 2026"
            maxLength={200}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {importTab === 'paste' ? (
          <div className="mb-4">
            <label htmlFor="import-cv-text" className="mb-1.5 block text-label-sm font-semibold text-on-surface">
              CV text
            </label>
            <textarea
              id="import-cv-text"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste your CV here…"
              rows={12}
              className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ) : (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low px-4 py-8 text-center transition-colors hover:border-primary hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant" aria-hidden="true">upload_file</span>
              <span className="text-body-sm font-semibold text-on-surface">
                {importFile ? importFile.name : 'Click to select PDF, DOCX, or TXT'}
              </span>
              {importFile && (
                <span className="text-label-sm text-on-surface-variant">
                  {(importFile.size / 1024).toFixed(0)} KB
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="sr-only"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-lg bg-error-container px-3 py-2 text-label-sm text-on-error-container">
            {error}
          </p>
        )}

        <DrawerFooter>
          <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>Cancel</Button>
          <Button variant="primary" size="sm" loading={importing} onClick={() => void handleImport()}>
            Save CV
          </Button>
        </DrawerFooter>
      </Drawer>
    </>
  );
}
