'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { UserCvRow } from '@/lib/cvs/repo';

export interface CvPickerChipProps {
  currentCvId: string | null;
  cvs: UserCvRow[];
  onSwitchCv: (cvId: string) => void;
  onCreateNew: () => void;
}

/**
 * CvPickerChip — pill with dropdown to switch between user CVs.
 *
 * Closed state: "CV: <name>" pill + caret.
 * Open: dropdown listing all CVs (default badge), "+ New CV", "Manage all" link.
 */
export function CvPickerChip({
  currentCvId,
  cvs,
  onSwitchCv,
  onCreateNew,
}: CvPickerChipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentCv = cvs.find((cv) => cv.id === currentCvId) ?? cvs[0] ?? null;
  const displayName = currentCv?.name ?? 'No CV';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5',
          'text-label-sm font-semibold transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          open
            ? 'border-primary bg-primary-container text-on-primary-container'
            : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container',
        )}
      >
        <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">
          description
        </span>
        <span className="max-w-[120px] truncate">
          CV: {displayName}
        </span>
        <span
          className={cn(
            'material-symbols-outlined text-[14px] leading-none transition-transform duration-150',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch CV"
          className={cn(
            'absolute right-0 top-full z-50 mt-1.5 w-64',
            'rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-lg',
            'overflow-hidden',
          )}
        >
          {cvs.length === 0 ? (
            <div className="px-4 py-3 text-body-sm text-on-surface-variant">
              No CVs yet.
            </div>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {cvs.map((cv) => {
                const isSelected = cv.id === currentCvId;
                return (
                  <li key={cv.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSwitchCv(cv.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors',
                        'text-body-sm focus-visible:outline-none focus-visible:bg-surface-container-high',
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-on-surface hover:bg-surface-container-low',
                      )}
                    >
                      <span className="flex-1 truncate">{cv.name}</span>
                      {cv.isDefault && (
                        <span className="shrink-0 rounded-full bg-tertiary-fixed px-1.5 py-0.5 text-[10px] font-bold text-on-tertiary-fixed">
                          Default
                        </span>
                      )}
                      {isSelected && (
                        <span className="material-symbols-outlined shrink-0 text-[14px] text-primary" aria-hidden="true">
                          check
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-outline-variant">
            <button
              type="button"
              onClick={() => {
                onCreateNew();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-body-sm text-primary transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">add</span>
              New CV
            </button>
            <Link
              href="/cvs"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">folder_open</span>
              Manage all CVs
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
