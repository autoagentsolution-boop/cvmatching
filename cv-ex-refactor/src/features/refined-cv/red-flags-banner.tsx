'use client';

import { useState } from 'react';
import { MdExpandMore, MdExpandLess } from 'react-icons/md';

export interface RedFlagsBannerProps {
  redFlags: Array<{ flag: string; concern: string }>;
}

// Banner for /refined-cv top. Collapsed by default — preserves scan-first ergonomics.
// Returns null when empty so layout shifts only when there's something to surface.
export function RedFlagsBanner({ redFlags }: RedFlagsBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!redFlags?.length) return null;

  const count = redFlags.length;

  return (
    <div
      role="region"
      aria-label="Cảnh báo CV gốc"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
      >
        <span className="flex items-center gap-2 text-body-md font-semibold">
          <span aria-hidden="true">⚠️</span>
          CV gốc có {count} điểm cần xem lại trước khi refine.
        </span>
        <span className="flex items-center gap-1 text-label-md font-bold">
          {expanded ? 'Ẩn' : 'Xem chi tiết'}
          {expanded ? (
            <MdExpandLess size={20} aria-hidden="true" />
          ) : (
            <MdExpandMore size={20} aria-hidden="true" />
          )}
        </span>
      </button>

      {expanded && (
        <ul className="mt-3 flex flex-col gap-3 border-t border-amber-200 pt-3">
          {redFlags.map((rf, i) => (
            <li key={i} className="flex flex-col gap-0.5">
              <p className="text-body-sm font-semibold">{rf.flag}</p>
              <p className="text-body-sm text-amber-900/80">{rf.concern}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
