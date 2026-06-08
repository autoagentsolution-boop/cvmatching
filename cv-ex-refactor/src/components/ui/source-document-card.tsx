'use client';

import { useState, type ReactNode } from 'react';
import { MdZoomIn, MdZoomOut, MdFullscreen, MdFileUpload, MdEdit } from 'react-icons/md';
import { cn } from '@/lib/cn';
import { Modal } from './modal';
import { SourceDocumentPage, type SourceDocumentKind } from './source-document-page';

const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export interface SourceDocumentCardProps {
  /** Parsed-text body. Empty string renders the empty/import state. */
  content: string;
  /** Drives the SOURCE CV / SOURCE JD header label and section detection. */
  kind: SourceDocumentKind;
  /** Initial zoom level. Defaults to 1 (100%). */
  defaultZoom?: ZoomLevel;
  /** Triggered when user clicks the Import action. Parent owns the picker UX. */
  onImport?: () => void;
  /** Triggered when user clicks Edit. Parent opens a drawer/modal with a textarea. */
  onEdit?: () => void;
  /** Extra class names on the outer card container. */
  className?: string;
  /** Optional ribbon shown in the empty state to suggest a paste/upload action. */
  emptyHint?: ReactNode;
}

const KIND_LABEL: Record<SourceDocumentKind, string> = {
  cv: 'Source CV',
  jd: 'Source JD',
};

function ToolbarIconButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors',
        'hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

/**
 * SourceDocumentCard — workflow source panel.
 *
 * Owns chrome (label, zoom, fullscreen, Import/Edit slots) + the modal overlay.
 * Delegates page rendering to SourceDocumentPage.
 *
 * Consumed by cv-analyze + jd-matching step pages via WorkflowLayout's
 * `sourceDocuments` slot.
 */
export function SourceDocumentCard({
  content,
  kind,
  defaultZoom = 1,
  onImport,
  onEdit,
  className,
  emptyHint,
}: SourceDocumentCardProps) {
  const [zoom, setZoom] = useState<ZoomLevel>(defaultZoom);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const zoomIdx = ZOOM_LEVELS.indexOf(zoom);
  const canZoomIn = zoomIdx < ZOOM_LEVELS.length - 1;
  const canZoomOut = zoomIdx > 0;

  function handleZoomIn() {
    const next = ZOOM_LEVELS[zoomIdx + 1];
    if (next !== undefined) setZoom(next);
  }
  function handleZoomOut() {
    const prev = ZOOM_LEVELS[zoomIdx - 1];
    if (prev !== undefined) setZoom(prev);
  }

  const hasContent = content.trim().length > 0;

  return (
    <>
      <div
        className={cn(
          'flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            {KIND_LABEL[kind]}
          </span>
          <div className="flex items-center gap-0.5">
            {onEdit && (
              <ToolbarIconButton onClick={onEdit} label="Edit">
                <MdEdit size={16} aria-hidden="true" />
              </ToolbarIconButton>
            )}
            {onImport && (
              <ToolbarIconButton onClick={onImport} label="Import">
                <MdFileUpload size={16} aria-hidden="true" />
              </ToolbarIconButton>
            )}
            <ToolbarIconButton
              onClick={handleZoomOut}
              label="Zoom out"
              disabled={!canZoomOut || !hasContent}
            >
              <MdZoomOut size={16} aria-hidden="true" />
            </ToolbarIconButton>
            <span className="px-1 text-[10px] tabular-nums text-on-surface-variant/70 min-w-[2.5rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <ToolbarIconButton
              onClick={handleZoomIn}
              label="Zoom in"
              disabled={!canZoomIn || !hasContent}
            >
              <MdZoomIn size={16} aria-hidden="true" />
            </ToolbarIconButton>
            <ToolbarIconButton
              onClick={() => setIsFullscreen(true)}
              label="Fullscreen"
              disabled={!hasContent}
            >
              <MdFullscreen size={16} aria-hidden="true" />
            </ToolbarIconButton>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-surface-container-low p-3">
          {hasContent ? (
            <SourceDocumentPage content={content} kind={kind} zoom={zoom} />
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <p className="text-body-sm text-on-surface-variant">
                No {kind === 'cv' ? 'CV' : 'job description'} loaded yet.
              </p>
              {emptyHint}
              {onImport && (
                <button
                  type="button"
                  onClick={onImport}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-label-md font-medium text-on-primary hover:bg-primary/90 transition-colors"
                >
                  <MdFileUpload size={16} aria-hidden="true" />
                  Import {kind === 'cv' ? 'CV' : 'JD'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen modal — Modal accepts className override per ui/modal.tsx contract */}
      <Modal
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        size="lg"
        className="max-w-[min(calc(100vw-3rem),10in)] max-h-[calc(100vh-3rem)] overflow-auto p-6"
      >
        <div className="mb-3 flex items-center justify-between gap-2 pr-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            {KIND_LABEL[kind]}
          </span>
          <div className="flex items-center gap-0.5">
            <ToolbarIconButton
              onClick={handleZoomOut}
              label="Zoom out"
              disabled={!canZoomOut}
            >
              <MdZoomOut size={16} aria-hidden="true" />
            </ToolbarIconButton>
            <span className="px-1 text-[10px] tabular-nums text-on-surface-variant/70 min-w-[2.5rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <ToolbarIconButton
              onClick={handleZoomIn}
              label="Zoom in"
              disabled={!canZoomIn}
            >
              <MdZoomIn size={16} aria-hidden="true" />
            </ToolbarIconButton>
          </div>
        </div>
        <SourceDocumentPage content={content} kind={kind} zoom={zoom} />
      </Modal>
    </>
  );
}
