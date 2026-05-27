'use client';

import { useRef, useState, type DragEvent, type ChangeEvent, type ReactNode } from 'react';
import { MdCloudUpload } from 'react-icons/md';
import { cn } from '@/lib/cn';

export interface DropZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  maxSizeMb?: number;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}

function getExtensions(accept: string): string[] {
  return accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function fileMatchesAccept(file: File, accept: string): boolean {
  const exts = getExtensions(accept);
  if (exts.length === 0) return true;
  const nameLower = file.name.toLowerCase();
  return exts.some((ext) => nameLower.endsWith(ext));
}

export function DropZone({
  onFile,
  accept = '.pdf,.docx,.txt',
  maxSizeMb = 4.5,
  title,
  subtitle,
  disabled = false,
  icon,
  className,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  function validate(file: File): string | null {
    if (maxSizeMb > 0 && file.size > maxSizeMb * 1024 * 1024) {
      return `File exceeds ${maxSizeMb} MB limit.`;
    }
    if (!fileMatchesAccept(file, accept)) {
      return `Unsupported file type. Accepted: ${accept}`;
    }
    return null;
  }

  function handleFile(file: File) {
    const error = validate(file);
    if (error) {
      setInlineError(error);
      return;
    }
    setInlineError(null);
    onFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-8',
          'cursor-pointer transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/20',
          isDragOver
            ? 'border-on-tertiary-container bg-tertiary-fixed/20'
            : inlineError
              ? 'border-error bg-error-container/20'
              : 'border-outline-variant bg-surface-container-lowest hover:border-on-tertiary-container hover:bg-tertiary-fixed/10',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
          {icon ?? <MdCloudUpload size={24} aria-hidden="true" />}
        </div>
        <div className="text-center">
          <p className="text-label-md font-medium text-on-surface">{title}</p>
          {subtitle && (
            <p className="mt-1 text-label-sm text-on-surface-variant">{subtitle}</p>
          )}
          <p className="mt-1 text-label-sm text-on-surface-variant/60">
            {accept} · max {maxSizeMb} MB
          </p>
        </div>
      </div>
      {inlineError && (
        <p className="text-label-sm text-error" role="alert">{inlineError}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
